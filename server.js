// server.js
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors'); // เพิ่ม cors module
const app = express();
const port = process.env.PORT || 3000;

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_TARGET_ID = process.env.LINE_TARGET_ID;

if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_TARGET_ID) {
    console.error('ERROR: LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_TARGET_ID ไม่ได้ถูกตั้งค่าใน .env.');
    console.error('โปรดตรวจสอบไฟล์ .env และตั้งค่าให้ถูกต้อง.');
    process.exit(1);
}

const LINE_PUSH_MESSAGE_URL = 'https://api.line.me/v2/bot/message/push';

// --- เพิ่ม CORS Middleware เพื่ออนุญาต Cross-Origin Requests ---
// อนุญาตให้โดเมน terd2543.github.io สามารถส่ง Request มายัง Server นี้ได้
// *** สำคัญมาก: ใน Production ควรจำกัด origins ให้เฉพาะโดเมนที่ต้องการเท่านั้น ***
app.use(cors({
    origin: 'https://terd2543.github.io', // อนุญาตเฉพาะโดเมน GitHub Pages ของคุณ
    methods: 'GET,POST', // อนุญาตเฉพาะเมธอด GET และ POST
    allowedHeaders: 'Content-Type'
}));
// ---

// เพิ่ม middleware สำหรับ parsing JSON body จาก Request
app.use(express.json());

// Route สำหรับรับข้อมูลผู้เข้าชมจาก Client (เว็บไซต์ GitHub Pages)
app.post('/notify-visitor', async (req, res) => {
    // ข้อมูลจะถูกส่งมาใน req.body จาก JavaScript ฝั่ง Client
    const { ip, userAgent, time } = req.body;

    if (!ip || !userAgent || !time) {
        return res.status(400).json({ error: 'Missing visitor data (ip, userAgent, time)' });
    }

    const message = `IP: ${ip}\nอุปกรณ์: ${userAgent}\nเวลา: ${time}`;

    console.log(`ได้รับข้อมูลผู้เข้าชมจาก Client: ${message}`);

    const postData = {
        to: LINE_TARGET_ID,
        messages: [{
            type: 'text',
            text: message
        }]
    };

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    };

    try {
        await axios.post(LINE_PUSH_MESSAGE_URL, postData, { headers });
        console.log('ส่งการแจ้งเตือน LINE Messaging API สำเร็จ!');
        res.status(200).json({ message: 'Notification sent successfully!' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการส่ง LINE Messaging API:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to send LINE notification.' });
    }
});

// Route พื้นฐานสำหรับทดสอบ Server (ไม่จำเป็นต้องมีใน Production ถ้าใช้แค่ /notify-visitor)
app.get('/', (req, res) => {
    res.send('LINE Visitor Notifier Server is running. Send POST requests to /notify-visitor.');
});


// เริ่มต้น Web Server
app.listen(port, () => {
    console.log(`เซิร์ฟเวอร์ทำงานอยู่ที่พอร์ต ${port}`);
    console.log(`โปรดใช้ Public URL ของ Render.com เพื่อส่ง Request POST ไปยัง /notify-visitor.`);
});
