# 📦 PWA 現場在庫管理系統 (Smart Inventory PWA)

現場優先（Mobile-First）、高堅牢性離線快取（IndexedDB + Delta 同步）與 PC 端管理/標籤列印一體的現代化 PWA 在庫管理系統。

---

## 🚀 系統亮點 (Key Features)

- **📱 現場優先行動端 UI**:
  - 單手操作大型日文底部抽屜（【入荷】/【払出】/【在庫確認】/【発注依頼】/【新規追加】）。
  - 手套友善特大數字鍵盤（テンキー），支援自訂包裝規格（【箱】/【袋】/【本】/【個】）即時乘法換算。
  - 1.5 秒防重複刷讀冷卻（Debounce）、Web Audio API 雙音頻蜂鳴與手機觸覺震動。
- **📋 批次連續檢品・核對清單模式**:
  - 連續掃描多個條碼，畫面動態累加清單，可逐項核對、修正數量、切換單位後一鍵整批送出。
- **📷 雙軌條碼/QR 掃描 & 實體掃描槍支援**:
  - 整合 WebRTC 相機 + 一鍵手電筒補光（Torch）。
  - 支援藍牙/工業 PDA 實體雷射掃描槍（全域 HID 鍵盤監聽，0ms 延遲免開相機）。
  - 支援既有廠商條碼（JAN/EAN-13, Code-128）與自訂標準 QR 碼。
  - 內建自訂高解析度 QR Code 產生器（SVG 下載/單票列印）。
- **💻 PC 管理端 & A4 標籤列印**:
  - 品目主檔 CRUD 管理、安全庫存水位警戒監控。
  - CSV 批次匯入/匯出（強制帶入 UTF-8 BOM，防止 Excel 開啟亂碼）。
  - A4 標籤一括列印排版（支援市售 A-One 24面 / 44面 / 耐水透明封膜貼紙）。
  - 進出庫歷史受払記錄與統計。
- **⚡ 離線堅牢架構**:
  - 全量主檔本機 IndexedDB 快取（地下室無信號 0 延遲比對）。
  - 增量 Delta 同步機制（+Q / -Q），恢復網路時自動背景上傳，防止多人作業覆蓋。

---

## 🛠️ 技術棧 (Tech Stack)

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **PWA**: Service Worker, Web App Manifest
- **Hardware & Audio**: WebRTC MediaStream (Torch API), Web Audio API, Vibration API
- **Local DB**: IndexedDB (`idb`)
- **QR / Barcode**: `html5-qrcode`, `qrcode.react`

---

## 💻 快速開始 (Quick Start)

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 專案打包
npm run build

# 本地預覽
npm run preview
```
