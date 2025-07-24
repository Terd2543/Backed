// server.js
require('dotenv').config(); // โหลดตัวแปรสภาพแวดล้อมจากไฟล์ .env

const express = require('express');
const axios = require('axios');
const cors = require('cors'); // นำเข้าโมดูล cors
const app = express();
const port = process.env.PORT || 3000; // ใช้ PORT จาก environment (Render จะกำหนดให้) หรือ 3000 หากรัน Local

// ดึงตัวแปรสำคัญจาก Environment Variables
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_TARGET_ID = process.env.LINE_TARGET_ID;

// ตรวจสอบว่าตัวแปรจำเป็นถูกตั้งค่าแล้ว
if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_TARGET_ID) {
    console.error('ERROR: LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_TARGET_ID ไม่ได้ถูกตั้งค่า.');
    console.error('โปรดตรวจสอบ Environment Variables บน Render.com หรือไฟล์ .env ของคุณ.');
    process.exit(1); // หยุดการทำงานของแอปพลิเคชันหากไม่มี Token
}

// URL สำหรับ LINE Messaging API Push Message และ Reply Message
const LINE_PUSH_MESSAGE_URL = 'https://api.line.me/v2/bot/message/push';
const LINE_REPLY_MESSAGE_URL = 'https://api.line.me/v2/bot/message/reply';

// Headers ทั่วไปสำหรับส่ง Request ไปยัง LINE Messaging API
const LINE_API_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
};

// --- Middleware ---
// 1. CORS (Cross-Origin Resource Sharing)
// อนุญาตให้โดเมน terd2543.github.io สามารถส่ง Request (POST) มายัง Server นี้ได้
// *** ใน Production จริง คุณควรจำกัด 'origin' ให้เป็นโดเมนเว็บไซต์ของคุณเท่านั้น เพื่อความปลอดภัย ***
app.use(cors({
    origin: 'https://terd2543.github.io', // อนุญาตเฉพาะโดเมน GitHub Pages ของคุณ
    methods: ['GET', 'POST'], // อนุญาตเฉพาะเมธอด GET และ POST
    allowedHeaders: ['Content-Type'] // อนุญาตให้ Client ส่ง Content-Type header มาได้
}));

// 2. Body Parser สำหรับ JSON
// Middleware นี้จะช่วยแปลง JSON string ที่ส่งมาใน body ของ Request ให้เป็น JavaScript object
app.use(express.json());

// --- ฟังก์ชันช่วยเหลือสำหรับ LINE API ---

/**
 * ส่งข้อความแบบ Push Message ไปยัง User ID หรือ Group ID ที่กำหนด
 * ใช้สำหรับส่งข้อความใดๆ ก็ได้ เมื่อไหร่ก็ได้ (เช่นแจ้งเตือน IP)
 * @param {string} toId - User ID หรือ Group ID ที่ต้องการส่งข้อความไปหา
 * @param {string} messageText - ข้อความที่จะส่ง
 * @returns {Promise<boolean>} true หากส่งสำเร็จ, false หากเกิดข้อผิดพลาด
 */
async function sendPushMessage(toId, messageText) {
    try {
        const postData = {
            to: toId,
            messages: [{ type: 'text', text: messageText }]
        };
        await axios.post(LINE_PUSH_MESSAGE_URL, postData, { headers: LINE_API_HEADERS });
        console.log(`[LINE Push] ส่งข้อความสำเร็จไปยัง ${toId}: "${messageText}"`);
        return true;
    } catch (error) {
        console.error(`[LINE Push Error] ไม่สามารถส่งข้อความไปยัง ${toId}:`, error.response ? error.response.data : error.message);
        return false;
    }
}

/**
 * ส่งข้อความตอบกลับ (Reply Message)
 * ต้องใช้ replyToken ที่ได้รับจาก Webhook event ภายใน 30 วินาที
 * @param {string} replyToken - Token สำหรับตอบกลับที่ได้รับจาก LINE Webhook event
 * @param {string} messageText - ข้อความที่จะตอบกลับ
 * @returns {Promise<boolean>} true หากส่งสำเร็จ, false หากเกิดข้อผิดพลาด
 */
async function replyMessage(replyToken, messageText) {
    try {
        const postData = {
            replyToken: replyToken,
            messages: [{ type: 'text', text: messageText }]
        };
        await axios.post(LINE_REPLY_MESSAGE_URL, postData, { headers: LINE_API_HEADERS });
        console.log(`[LINE Reply] ตอบกลับสำเร็จด้วย: "${messageText}"`);
        return true;
    } catch (error) {
        console.error(`[LINE Reply Error] ไม่สามารถตอบกลับ:`, error.response ? error.response.data : error.message);
        return false;
    }
}

// --- Routes (Endpoints) ของ Server ---

// 1. Route สำหรับรับข้อมูลผู้เข้าชมจาก Client (เว็บไซต์ GitHub Pages)
app.post('/notify-visitor', async (req, res) => {
    // ข้อมูล (IP, userAgent, time) จะถูกส่งมาใน req.body จาก JavaScript ฝั่ง Client
    const { ip, userAgent, time } = req.body;

    // ตรวจสอบข้อมูลที่ได้รับ
    if (!ip || !userAgent || !time) {
        console.warn('Received incomplete visitor data from client.');
        return res.status(400).json({ error: 'Missing visitor data (ip, userAgent, time).' });
    }

    // สร้างข้อความแจ้งเตือน
    const message = `IP: ${ip}\nอุปกรณ์: ${userAgent}\nเวลา: ${time}`;
    console.log(`[Visitor Notify] ได้รับข้อมูลผู้เข้าชมจาก Client: ${message}`);

    // ส่งข้อความแจ้งเตือนผ่าน LINE Messaging API ไปยัง LINE_TARGET_ID
    const notificationSent = await sendPushMessage(LINE_TARGET_ID, message);

    if (notificationSent) {
        res.status(200).json({ message: 'Notification sent successfully!' });
    } else {
        res.status(500).json({ error: 'Failed to send LINE notification.' });
    }
});

// 2. Webhook Endpoint สำหรับรับ Event จาก LINE
app.post('/webhook', async (req, res) => {
    // LINE จะส่ง Event Object มาใน req.body.events
    const events = req.body.events;

    // Log เพื่อดูโครงสร้าง Event ที่ได้รับ (มีประโยชน์ในการ Debug)
    console.log('[Webhook] Received LINE Webhook events:', JSON.stringify(events, null, 2));

    // ตรวจสอบว่ามี events อยู่หรือไม่
    if (!events || events.length === 0) {
        return res.status(200).send('No events to process.'); // ตอบกลับ 200 OK แม้ไม่มี Event
    }

    // ประมวลผลแต่ละ Event ที่ LINE ส่งมา
    for (const event of events) {
        switch (event.type) {
            case 'message':
                // ถ้าเป็น Event ประเภทข้อความ (user พิมพ์ข้อความมา)
                if (event.message.type === 'text') {
                    const userMessage = event.message.text; // ข้อความที่ผู้ใช้พิมพ์
                    const replyToken = event.replyToken; // Token สำหรับตอบกลับ (ใช้ได้ครั้งเดียว ภายใน 30 วิ)
                    const userId = event.source.userId; // User ID ของผู้ที่ส่งข้อความมา

                    console.log(`[Webhook Message] ผู้ใช้ ${userId} ส่งข้อความ: "${userMessage}"`);

                    let responseText = '';
                    // ตัวอย่าง Logic การตอบกลับ:
                    if (userMessage.toLowerCase() === 'ip') {
                        responseText = 'ฟังก์ชันแจ้งเตือน IP ทำงานเมื่อมีคนเข้าชมเว็บไซต์ ไม่สามารถดู IP ผ่านแชทโดยตรงได้ครับ';
                    } else if (userMessage.toLowerCase() === 'hello') {
                        responseText = 'สวัสดีครับ! มีอะไรให้รับใช้ครับ?';
                    } else if (userMessage.toLowerCase() === 'what') {
                        responseText = 'เราคือ LINE Bot ที่แจ้งเตือนเมื่อมีคนเข้าชมเว็บไซต์ของคุณ และสามารถโต้ตอบพื้นฐานได้ครับ';
                    } else {
                        responseText = `เราได้รับข้อความของคุณแล้ว: "${userMessage}" ตอนนี้บอทยังไม่รองรับคำสั่งนี้ครับ`;
                    }

                    // ส่งข้อความตอบกลับไปยังผู้ใช้
                    await replyMessage(replyToken, responseText);
                }
                break;

            case 'follow':
                // ถ้ามีคนเพิ่มเพื่อน (Follow) Bot
                const userIdFollow = event.source.userId;
                console.log(`[Webhook Follow] ผู้ใช้ ${userIdFollow} เพิ่มบอทเป็นเพื่อน`);
                // ส่งข้อความต้อนรับ (ใช้ Push Message เพราะไม่มี replyToken)
                await sendPushMessage(userIdFollow, 'ขอบคุณที่เพิ่มเราเป็นเพื่อนครับ! ยินดีต้อนรับสู่ LINE Bot ของเรา');
                break;

            case 'unfollow':
                // ถ้ามีคนบล็อกหรือลบเพื่อน (Unfollow) Bot
                const userIdUnfollow = event.source.userId;
                console.log(`[Webhook Unfollow] ผู้ใช้ ${userIdUnfollow} ได้บล็อก/ลบเพื่อนบอท`);
                // ในกรณีนี้ ปกติจะไม่มีการตอบกลับ เพราะผู้ใช้ unfollow ไปแล้ว
                // อาจจะใช้สำหรับลบข้อมูลผู้ใช้จากฐานข้อมูลของคุณ
                break;

            // สามารถเพิ่มการจัดการ Event ประเภทอื่นๆ ได้อีก เช่น 'postback', 'join', 'leave', 'beacon'
            default:
                console.log(`[Webhook Info] ได้รับ Event ประเภท ${event.type} ที่ยังไม่ได้ถูกจัดการ.`);
                break;
        }
    }

    // LINE ต้องการการตอบกลับ 200 OK เพื่อยืนยันว่า Server ได้รับ Event แล้ว
    res.status(200).send('Event received and processed.');
});

// --- Route พื้นฐานสำหรับทดสอบ Server ---
app.get('/', (req, res) => {
    res.send('LINE Visitor Notifier Server is running. Ready to receive POST requests to /notify-visitor and /webhook.');
});

// --- เริ่มต้น Web Server ---
app.listen(port, () => {
    console.log(`เซิร์ฟเวอร์ Node.js ทำงานอยู่ที่พอร์ต ${port}`);
    console.log(`เตรียมพร้อมสำหรับการ Deploy บน Render.com`);
    console.log(`Webhook URL สำหรับ LINE คือ: [YOUR_RENDER_PUBLIC_URL]/webhook`);
    console.log(`API Endpoint สำหรับเว็บไซต์คือ: [YOUR_RENDER_PUBLIC_URL]/notify-visitor`);
});
