const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// เพิ่ม CORS headers เพื่อให้สามารถเรียก API จาก frontend ได้ (ถ้าจำเป็น)
// นี่เป็นวิธีที่ง่ายที่สุด แต่สำหรับการใช้งานจริง ควรจำกัด origin ให้ปลอดภัยยิ่งขึ้น
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // อนุญาตทุกโดเมน (ควรเปลี่ยนเป็นโดเมนของ frontend คุณ)
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

const CHANNEL_ACCESS_TOKEN = 'NMTL4RrSTof+k8Y2Mn1rWP6eZz8wYbb5IfwgO0XCFmxSmgv0E3Ud+KSlMo67XHtIDqRjs6NYvwo9zbt6kuUcdT5FlttR9Qyp0w4BQ7Oq2v8wEjKy7rZGJmyowkOZ61wshsHxImHqxlVayegtiHqxlVayegtiG/0QdB04t89/1O/w1cDnyilFU=';
const USER_ID = 'U04e9a87b455ee37facd0ad88942b96a5';

// *** เพิ่ม GET route สำหรับหน้าหลัก (/) เพื่อแก้ปัญหา "Cannot GET /" ***
// เมื่อมีคนเข้าถึง URL หลักของเซิร์ฟเวอร์ จะแสดงข้อความนี้
app.get('/', (req, res) => {
  res.status(200).send('Server is up and running! This is a backend service.');
});

app.post('/log-visit', async (req, res) => {
  const { ip, device, time, browser } = req.body;

  // ตรวจสอบว่าข้อมูลที่จำเป็นครบถ้วนหรือไม่
  if (!ip || !device || !time || !browser) {
    return res.status(400).send('Missing required fields: ip, device, time, browser');
  }

  const message = `
🚨 มีคนเข้าเว็บ!
📍 IP: ${ip}
💻 อุปกรณ์: ${device}
🌐 เบราว์เซอร์: ${browser}
🕒 เวลา: ${time}
`;

  try {
    await axios.post('https://api.line.me/v2/bot/message/push', {
      to: USER_ID,
      messages: [{ type: 'text', text: message }]
    }, {
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).send("Message sent successfully!"); // เปลี่ยนเป็นส่งข้อความยืนยัน
  } catch (err) {
    console.error('Error sending LINE message:', err.response ? err.response.data : err.message);
    // ส่งข้อความ error ที่ชัดเจนขึ้นกลับไปให้ client
    res.status(500).send("Error sending message to LINE: " + (err.response ? JSON.stringify(err.response.data) : err.message));
  }
});

// ดึง PORT จาก Environment Variable ถ้ามี หรือใช้ 3000 เป็นค่าเริ่มต้น
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log('Ready to receive POST requests at /log-visit');
});
