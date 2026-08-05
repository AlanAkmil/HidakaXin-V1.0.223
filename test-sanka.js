// Jalanin ini di Termux: node test-sanka.js
// Buat mastiin domain/struktur API sanka yang masih hidup sekarang.
const axios = require('axios');

const candidates = [
  'https://www.sankavollerei.web.id/anime/home',
  'https://www.sankavollerei.com/anime/home',
  'https://sankavollerei.com/anime/home',
];

(async () => {
  for (const url of candidates) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      console.log('OK  ', url, '-> status', res.status, 'ok:', res.data?.ok);
      console.log('     keys:', Object.keys(res.data?.data || res.data || {}));
    } catch (err) {
      console.log('FAIL', url, '->', err.response?.status || err.code || err.message);
      if (err.response?.data) {
        console.log('     body:', JSON.stringify(err.response.data).slice(0, 300));
      }
    }
    console.log('---');
  }
})();
