Aegis Vanguard — イージス・ヴァンガード（概要）

クイックスタート:
1. start.command に実行権限を付与: chmod +x start.command
2. サーバ起動: ./start.command 8000
3. 表示されたURLをブラウザで開く、またはQRをスキャンしてモバイルでプレイ

テスト実行 (Node と Playwright が必要):
- npm install
- npm test

アセット生成:
- scripts/generate_imgen4_prompts.js で imgen4 用プロンプトを出力します。

注意事項:
- 生成した画像は緑背景 (#00FF00) で出力し、src/chromakey.js が透過処理を行います（事前に処理してコミットするワークフロー推奨）。
- 音声は Web Audio API の合成で生成します。外部音声ファイルは不要です。
