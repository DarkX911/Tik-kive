const express = require('express');
const { spawn } = require('child_process');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let ffmpegProcess = null;
let streamStatus = { running: false, log: 'البث متوقف' };

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>لوحة تحكم البث المباشر - TikTok Live</title>
        <style>
            body { font-family: system-ui, sans-serif; background: #0f172a; color: #fff; padding: 20px; display: flex; justify-content: center; }
            .card { background: #1e293b; padding: 25px; border-radius: 12px; width: 100%; max-width: 500px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h2 { text-align: center; color: #38bdf8; }
            label { display: block; margin-top: 15px; font-size: 14px; color: #94a3b8; }
            input { width: 100%; padding: 10px; margin-top: 5px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: #fff; box-sizing: border-box; }
            .btn-group { display: flex; gap: 10px; margin-top: 20px; }
            button { flex: 1; padding: 12px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
            .btn-start { background: #22c55e; color: #fff; }
            .btn-stop { background: #ef4444; color: #fff; }
            .status { margin-top: 20px; padding: 10px; background: #0f172a; border-radius: 6px; font-size: 13px; color: #f59e0b; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>لوحة بث TikTok</h2>
            <form action="/start" method="POST">
                <label>رابط فيديو القرآن (أو رابط مباشر MP4/m3u8):</label>
                <input type="text" name="videoUrl" placeholder="https://..." required>
                
                <label>رابط السيرفر (TikTok RTMP URL):</label>
                <input type="text" name="rtmpUrl" placeholder="rtmp://..." required>

                <label>مفتاح البث (Stream Key):</label>
                <input type="password" name="streamKey" placeholder="XXXX-XXXX-XXXX" required>

                <div class="btn-group">
                    <button type="submit" class="btn-start">بدء البث / Start</button>
                    <button type="button" class="btn-stop" onclick="stopStream()">إيقاف / Stop</button>
                </div>
            </form>

            <div class="status">
                <strong>حالة البث:</strong> <span id="statusText">جاري التحميل...</span>
            </div>
        </div>

        <script>
            function updateStatus() {
                fetch('/status').then(r => r.json()).then(d => {
                    document.getElementById('statusText').innerText = d.log;
                });
            }
            function stopStream() {
                fetch('/stop', { method: 'POST' }).then(() => updateStatus());
            }
            setInterval(updateStatus, 3000);
            updateStatus();
        </script>
    </body>
    </html>
    `);
});

app.post('/start', (req, res) => {
    const { videoUrl, rtmpUrl, streamKey } = req.body;
    const fullRtmpDestination = `${rtmpUrl}/${streamKey}`;

    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGKILL');
    }

    const ffmpegArgs = [
        '-re',
        '-stream_loop', '-1',
        '-i', videoUrl,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-maxrate', '3000k',
        '-bufsize', '6000k',
        '-pix_fmt', 'yuv420p',
        '-g', '50',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-f', 'flv',
        fullRtmpDestination
    ];

    ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    ffmpegProcess.stdout.on('data', data => { streamStatus.log = 'البث شغال حالياً...'; });
    ffmpegProcess.stderr.on('data', data => { 
        streamStatus.log = 'جاري البث لـ TikTok...'; 
    });
    ffmpegProcess.on('close', code => {
        streamStatus.running = false;
        streamStatus.log = `تم إيقاف البث (كود: ${code})`;
        ffmpegProcess = null;
    });

    streamStatus.running = true;
    streamStatus.log = 'تم تشغيل البث بنجاح!';
    res.redirect('/');
});

app.post('/stop', (req, res) => {
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGKILL');
        ffmpegProcess = null;
        streamStatus.running = false;
        streamStatus.log = 'تم إيقاف البث يدويًا.';
    }
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    res.json(streamStatus);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dashboard running on port ${PORT}`));
