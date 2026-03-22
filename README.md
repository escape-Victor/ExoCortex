# ExoCortex
ExoCortex 是一款面向数字极客的离线优先个人知识管理（PKM）与辅助思考系统。它将本地大语言模型（LLM）、自动化闪卡提取、书签管理以及多端文件同步无缝整合在一个纯粹、高效的终端风格界面中，旨在成为你大脑的数字延伸。

##  核心特性

*  纯本地 AI 外脑 (Local AI Chat)
    * 原生对接本地运行的 Qwen 1.5B 大模型（通过本地 API）。
    * 采用树状结构管理对话历史，支持多时间线记忆读取与保存。
    * 纯净的终端绿黑配色 UI，拒绝多余干扰。
*  知识锻造炉 (Knowledge Forge & Anki)
    * **一键提取**：将大段生涩文本丢给 AI，自动提炼并输出为标准 JSON 格式的 QA 闪卡。
    * **海马体注入**：支持手动微调并分类存入本地 SQLite 数据库（`hacker_brain.db`）。
    * **记忆库管理**：内置卡片浏览器，随时回顾或清理已消化的知识。
*  知识连接站 (Nexus)
    * 极速收录播客、博客与网页书签，支持自定义标签分类。
    * 内置安全纯净的 Web 视图，直接在应用内唤起浏览器，保持沉浸式阅读。
*  个人收件箱 (Inbox)
    * **多重封印的邮箱直连**：防跳转、防劫持的 Gmail Web 视图，禁止一切未经授权的 App 唤醒。
    * **Syncthing 暗网文件库**：直接监听并读取 Android 本地的 Syncthing 同步目录，实现 PC 端与移动端的物理级文件流转。

##  技术栈

* **框架**: React Native & Expo
* **导航**: React Navigation (Bottom Tabs & Drawer)
* **本地存储**: Expo SQLite (`expo-sqlite`), AsyncStorage
* **系统交互**: Expo File System (Storage Access Framework), Expo Web Browser, React Native WebView
* **AI 接口**: 兼容 OpenAI 格式的本地 LLM API (`http://127.0.0.1:8080/v1/chat/completions`)

##  快速启动

### 1. 环境准备
确保你已安装 Node.js 和 Expo CLI。同时，你需要在本地（或局域网同一网段下）运行一个兼容 OpenAI API 格式的大模型服务（推荐使用 Qwen 1.5B 配合 llama.cpp 或 vLLM，监听 `8080` 端口）。

### 2. 安装依赖
```bash
# 克隆仓库
git clone https://github.com/yourusername/ExoCortex.git
cd ExoCortex

# 安装依赖项
npm install
```

### 3. 运行应用
```bash
# 启动 Expo 开发服务器
npx expo start
```
你可以使用 Expo Go 扫描二维码在真机上预览，或者在 Android/iOS 模拟器中运行。

##  配置说明

* **本地模型 API**: 若你的本地模型未运行在 `127.0.0.1:8080`，请在 `App.js` 中的 `fetch` 请求处修改目标 IP 和端口。
* **Syncthing 目录**: 首次进入“收件箱-Syncthing”模式时，需要授予 Android 文件夹访问权限，请选择你实际的 Syncthing 同步目标文件夹。

---


