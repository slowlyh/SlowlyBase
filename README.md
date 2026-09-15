# ⚡ SlowlyBase

> **Simple, Modular & Lightweight WhatsApp Bot Base using [zapo-js](https://github.com/vinikjkkj/zapo) and SQLite Session.**

![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-black?style=flat-square&logo=node.js)
![Library](https://img.shields.io/badge/library-zapo--js-CB3837?style=flat-square)
![Database](https://img.shields.io/badge/session-SQLite-003B57?style=flat-square&logo=sqlite)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

SlowlyBase adalah base script bot WhatsApp yang dirancang agar **sederhana, mudah dikelola, dan modular**. Seluruh pengaturan terpusat di satu file konfigurasi (`config.js`), seluruh fitur dipisahkan berdasarkan kategori di folder `plugins/`, serta seluruh fungsi pendukung, handler, dan koneksi berada di folder `src/`.

---

## ✨ Fitur Utama

- 🧩 **Sistem Plugin Modular**: Setiap fitur berada dalam file terpisah di folder `plugins/<kategori>/`.
- 🔄 **Hot Reload Tanpa Restart**: Perubahan kode plugin langsung di-reload secara otomatis tanpa harus mematikan dan menyalakan ulang proses Node.js.
- 🗄️ **Penyimpanan SQLite Pure-JS**: Sesi WhatsApp dan database lokal memakai SQLite **tanpa kompilasi binary** — otomatis memakai `node:sqlite` bawaan Node.js (22.5+), dengan fallback ke `node-sqlite3-wasm` (WebAssembly). Tidak perlu `better-sqlite3` atau build tools.
- 🛡️ **Isolasi Error Antar-Plugin**: Error pada satu plugin tidak akan merusak alur pesan atau menjatuhkan bot.
- 📡 **Handler Lengkap**:
  - **Message Handler**: Parsing pesan otomatis, serialisasi objek `m`, lazy getters, dan downloader.
  - **Connection Handler**: Manajemen reconnect otomatis, QR code terminal, dan Pairing Code 8 karakter.
  - **Group Handler**: Caching metadata grup, deteksi admin, dan event peserta grup (add, remove, promote, demote).
  - **Contact Handler**: Sinkronisasi dan penyimpanan nama kontak ke SQLite.
- 🎨 **Dukungan Media Komprehensif**:
  - Voice Note (PTT) melalui `sock.sendVoiceNote(jid, buffer)`
  - Reaksi pesan via `sock.sendReact(jid, emoji, id)`
  - Link preview dengan custom thumbnail via `sock.sendThumbnail(jid, options)`
  - Konversi stiker, audio, dan gambar dengan `sharp` dan `file-type`.

---

## 📁 Struktur Direktori

```text
SlowlyBase/
├── config.js               # Pengaturan utama bot (owner, prefix, pairing, template pesan)
├── index.js                # Entry point utama bot
├── package.json            # Daftar dependensi & npm scripts
├── patch.js                # Patch kompatibilitas zapo-js
├── session/                # Direktori penyimpanan SQLite (session.sqlite & database.sqlite)
│   └── .gitkeep
├── src/
│   ├── connection.js       # Client connection, SQLite store, pairing, reconnector & media helper
│   ├── sqliteDriver.js     # Driver SQLite pure-JS (node:sqlite / node-sqlite3-wasm)
│   ├── database.js         # SQLite database helper (pure-JS) untuk kontak & grup
│   ├── handler.js          # Message serializer & command dispatcher
│   ├── groupHandler.js     # Handler event & cache metadata grup
│   ├── contactHandler.js   # Handler kontak & database tracker
│   ├── pluginManager.js    # Loader & file watcher untuk hot reload plugin
│   └── utils.js            # Buffer resolver, formatter, JID cleaner & helpers
└── plugins/
    ├── main/               # Menu utama, status, latency & panduan
    │   ├── menu.js
    │   ├── ping.js
    │   ├── speed.js
    │   └── help.js
    ├── group/              # Manajemen grup WhatsApp
    │   ├── hidetag.js
    │   ├── kick.js
    │   ├── promote.js
    │   ├── demote.js
    │   ├── linkgc.js
    │   ├── grupopen.js
    │   └── grupclose.js
    ├── media/              # Pengolahan media, voice note, thumbnail, reaction
    │   ├── react.js
    │   ├── tovn.js
    │   ├── thumbnail.js
    │   └── toimage.js
    ├── owner/              # Perintah khusus owner bot
    │   ├── eval.js
    │   ├── exec.js
    │   ├── reload.js
    │   ├── restart.js
    │   └── setprefix.js
    └── tools/              # Alat bantu & utilitas
        ├── get.js
        ├── qwa.js
        └── shortlink.js
```

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Prasyarat
- Node.js versi 20 atau yang lebih baru (disarankan 22.5+ agar memakai `node:sqlite` bawaan)
- npm / yarn / pnpm
- Tidak perlu compiler C++ / Python / build tools (SQLite sudah pure-JS/WASM)

### 2. Clone Repository
```bash
git clone https://github.com/slowlyh/SlowlyBase.git
cd SlowlyBase
```

### 3. Install Dependensi
```bash
npm install
```
> Script `postinstall` akan secara otomatis menjalankan `patch.js` untuk mengaktifkan dukungan custom nodes pada zapo-js.

### 4. Konfigurasi
Buka file `config.js` dan sesuaikan informasi berikut:
```javascript
export const config = {
  botName: 'SlowlyBase',
  ownerName: 'Hyuu',
  ownerNumber: '6281234567890', // Nomor owner bot
  prefixes: ['.', '#', '!', '/'],
  usePairingCode: true,         // true untuk pairing code, false untuk scan QR
  pairingNumber: '',            // Masukkan nomor WhatsApp bot jika ingin otomatis
  customPairing: '',            // 8 karakter custom pairing (opsional)

  pairingMaxRetries: 3,         // Batas percobaan saat server menolak (limit/rate-limit)
  pairingRetryDelayMs: 15000,   // Jeda dasar antar percobaan (dikalikan nomor percobaan)
  pairingCooldownMs: 20000,     // Jeda minimum antar permintaan kode
  pairingCodeTtlMs: 160000,     // Masa berlaku kode sebelum boleh minta ulang
  pairingNotReadyDelayMs: 3000, // Jeda saat koneksi belum siap

  deviceBrowser: 'Chrome',      // Label browser di "Perangkat Tertaut"
  deviceOsDisplayName: 'Windows',
  ...
}
```

> **Catatan Pairing Code**: WhatsApp membatasi permintaan kode per nomor. Jika server menolak dengan error `limit` / `rate-overlimit`, bot akan otomatis menunggu (backoff) lalu mencoba lagi sampai `pairingMaxRetries`. Jika tetap gagal, hapus perangkat tertaut yang tidak terpakai di HP, atau tunggu 15-40 menit sebelum mencoba lagi. Jika `pairingNumber` dikosongkan pada lingkungan tanpa TTY (mis. Docker), bot otomatis beralih ke mode QR.

> **Catatan Driver SQLite**: Secara default bot memakai `node:sqlite` (bawaan Node.js 22.5+). Untuk memaksa driver WebAssembly, set env `SLOWLYBASE_SQLITE_DRIVER=wasm`. Keduanya **tidak memerlukan kompilasi binary**.

### 5. Jalankan Bot
```bash
# Menjalankan bot normal
npm start

# Mode development dengan auto-reload saat file core diubah
npm run dev
```

Saat pertama kali dijalankan:
- Jika `usePairingCode: true`, masukkan nomor bot di terminal dan masukkan kode pairing yang muncul ke aplikasi WhatsApp di ponsel (**Perangkat Tertaut > Tautkan dengan nomor telepon**).
- Jika `usePairingCode: false`, scan QR Code yang tampil di layar terminal.

---

## 🧩 Cara Membuat Plugin Baru

Cukup buat file JavaScript baru di dalam subfolder `plugins/<kategori>/<nama_fitur>.js`:

```javascript
// plugins/tools/contoh.js

export default {
  command: 'contoh',               // Perintah utama (.contoh)
  alias: ['tes', 'sample'],         // Perintah alias (.tes, .sample)
  category: 'tools',               // Kategori fitur
  description: 'Contoh fitur baru',// Deskripsi perintah
  
  // Opsional: Pembatasan hak akses
  ownerOnly: false,                // Hanya owner
  groupOnly: false,                // Hanya di dalam grup
  privateOnly: false,              // Hanya di private chat
  adminOnly: false,                // Hanya admin grup
  botAdminOnly: false,             // Bot harus admin grup

  async execute(m, { sock, config, args, text, query, prefix, command }) {
    // Balas pesan biasa
    await m.reply(`Halo ${m.pushName}! Perintah yang kamu ketik: ${command}`)

    // Kirim reaction emoji
    await m.react('🎉')
  }
}
```

> ⚡ **Catatan Hot Reload**: Setelah menyimpan file baru atau mengedit plugin yang sudah ada, Anda **TIDAK PERLU** merestart bot! File watcher akan otomatis mendeteksi perubahan dan memperbarui memory secara instan. Anda juga bisa memicu reload manual dengan perintah `.reload`.

---

## 💡 Objek Pesan `m`

Pada setiap eksekusi plugin, objek `m` menyediakan berbagai properti dan fungsi praktis:

| Properti / Fungsi | Deskripsi |
| :--- | :--- |
| `m.chat` | JID percakapan saat ini (pribadi atau grup) |
| `m.sender` | JID pengirim pesan |
| `m.pushName` | Nama WhatsApp pengirim |
| `m.isGroup` | Boolean: apakah pesan berasal dari grup |
| `m.isOwner` | Boolean: apakah pengirim adalah owner bot |
| `m.isAdmin` | Boolean: apakah pengirim adalah admin grup |
| `m.isBotAdmin` | Boolean: apakah bot memiliki hak admin di grup |
| `m.text` / `m.body` | Isi teks lengkap dari pesan |
| `m.args` | Array argumen setelah command |
| `m.query` | String teks setelah command |
| `m.quoted` | Objek pesan yang di-reply / kutip (jika ada) |
| `m.reply(content)` | Membalas pesan secara langsung (otomatis quote) |
| `m.react(emoji)` | Memberikan reaksi emoji ke pesan |
| `m.download()` | Mengunduh buffer media dari pesan ini |
| `m.quoted.download()` | Mengunduh buffer media dari pesan yang dikutip |

---

## 🛠️ Contoh Penggunaan API Media

### Mengirim Voice Note (PTT)
```javascript
await sock.sendVoiceNote(m.chat, './audio.mp3', { quote: m.raw })
```

### Mengirim Reaksi
```javascript
await sock.sendReact(m.chat, '❤️', m.id)
```

### Mengirim Link Preview dengan Custom Thumbnail
```javascript
await sock.sendThumbnail(m.chat, {
  thumbnail: './gambar.jpg', // Path, Buffer, atau URL
  url: 'https://github.com/slowlyh/SlowlyBase',
  title: 'SlowlyBase Repository',
  body: 'Modular WhatsApp Bot with zapo-js',
  text: 'Klik link di atas untuk melihat source code.',
  quote: m.raw
})
```

---

## 📄 Lisensi

Distributed under the [MIT License](LICENSE).

Dibuat dengan ❤️ oleh **[Slowly / Hyuu](https://github.com/slowlyh)**.
