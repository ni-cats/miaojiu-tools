import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ClipboardHistoryWindow from './components/ClipboardHistoryWindow'
import './styles/global.css'

// 根据 URL hash 决定渲染主应用还是独立的剪贴板历史窗口
const isHistoryWindow = window.location.hash === '#clipboard-history'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isHistoryWindow ? <ClipboardHistoryWindow /> : <App />}
  </React.StrictMode>
)
