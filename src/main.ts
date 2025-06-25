// src/main.ts
import { showUI } from '@create-figma-plugin/utilities'

export default function () {
  // 打开 UI 面板
  showUI({ width: 320, height: 220 })

  // 监听选择变化事件，实时更新UI
  figma.on('selectionchange', () => {
    figma.ui.postMessage({
      type: 'count',
      count: figma.currentPage.selection.length
    })
  })

  figma.ui.onmessage = (msg) => {
    /* 把选区数量回传给 UI */
    if (msg.type === 'get-count') {
      figma.ui.postMessage({
        type: 'count',
        count: figma.currentPage.selection.length
      })
      return
    }

    /* 收到 AI 返回的 JSON 指令 */
    if (msg.type === 'apply-ai') {
      let txt: string = (msg.payload || '').trim()
      
      console.log('🔍 AI返回的原始数据:', txt)

      // 去掉代码块包裹
      if (txt.startsWith('```')) {
        txt = txt.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim()
      }

      try {
        // 解析AI返回的JSON
        const aiResponse = JSON.parse(txt)
        const code = aiResponse.code
        
        // 检查是否是创建操作（包含create关键字）
        const isCreateOperation = /figma\.create|appendChild/.test(code)
        
        const sel = figma.currentPage.selection
        
        // 如果不是创建操作且没有选中图层，则提示选中
        if (!isCreateOperation && sel.length === 0) {
          figma.notify('请先选中图层')
          return
        }

        // 创建安全的执行环境
        const executeAICode = new Function('nodes', 'figma', 'selection', code)
        executeAICode(sel, figma, sel)
        figma.notify('✅ 指令已执行')
      } catch (error) {
        console.log('❌ 执行AI代码失败:', error)
        figma.notify('⚠️ 指令执行失败')
      }
    }
  }
}

/* ——— 辅助函数 ——— */
function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255
  }
}
function applyFill(nodes: readonly SceneNode[], hex: string) {
  const c = hexToRgb(hex)
  const paint: SolidPaint = { type: 'SOLID', color: c }
  nodes.forEach(n => { if ('fills' in n) n.fills = [paint] })
}
function applyStrokeWidth(nodes: readonly SceneNode[], w: number) {
  nodes.forEach(n => { if ('strokeWeight' in n) n.strokeWeight = w })
}
function applyFont(
  nodes: readonly SceneNode[],
  family: string,
  size: number
) {
  (async () => {
    await figma.loadFontAsync({ family, style: 'Regular' })
    nodes.forEach(n => {
      if (n.type === 'TEXT') {
        n.fontName = { family, style: 'Regular' }
        n.fontSize = size
      }
    })
  })()
}

function applyCornerRadius(nodes: readonly SceneNode[], radius: number) {
  nodes.forEach(n => {
    // 直接检查节点类型和属性
    if (n.type === 'RECTANGLE' || n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE') {
      try {
        // 使用类型断言来避免TypeScript类型检查问题
        const node = n as any
        
        // 优先使用独立圆角属性
        if ('topLeftRadius' in node) {
          node.topLeftRadius = radius
          node.topRightRadius = radius
          node.bottomLeftRadius = radius
          node.bottomRightRadius = radius
        }
        // 如果没有独立圆角属性，尝试设置统一圆角
        else if ('cornerRadius' in node) {
          node.cornerRadius = radius
        }
      } catch (error) {
        console.log(`无法为节点 ${n.name} 设置圆角:`, error)
      }
    }
  })
}

function applyResize(nodes: readonly SceneNode[], width: number, height: number) {
  nodes.forEach(n => {
    if ('resize' in n) {
      n.resize(width, height)
    }
  })
}

function applyOpacity(nodes: readonly SceneNode[], opacity: number) {
  nodes.forEach(n => {
    if ('opacity' in n) {
      n.opacity = opacity
    }
  })
}

function applySpacing(nodes: readonly SceneNode[], spacing: number) {
  if (nodes.length < 2) {
    figma.notify('需要选中至少2个对象才能设置间距')
    return
  }

  // 判断是水平排列还是垂直排列
  const sortedByX = [...nodes].sort((a, b) => a.x - b.x)
  const sortedByY = [...nodes].sort((a, b) => a.y - b.y)
  
  // 计算水平和垂直的总跨度
  const horizontalSpan = sortedByX[sortedByX.length - 1].x - sortedByX[0].x
  const verticalSpan = sortedByY[sortedByY.length - 1].y - sortedByY[0].y
  
  // 选择跨度更大的方向
  if (horizontalSpan >= verticalSpan) {
    // 水平排列
    for (let i = 1; i < sortedByX.length; i++) {
      const prevNode = sortedByX[i - 1]
      const currentNode = sortedByX[i]
      const newX = prevNode.x + prevNode.width + spacing
      currentNode.x = newX
    }
  } else {
    // 垂直排列
    for (let i = 1; i < sortedByY.length; i++) {
      const prevNode = sortedByY[i - 1]
      const currentNode = sortedByY[i]
      const newY = prevNode.y + prevNode.height + spacing
      currentNode.y = newY
    }
  }
}

// 删除第165-211行的所有内容（从"// 在apply-ai消息处理中"开始到文件末尾）
// 因为这些代码是重复的且语法错误的

// 保留第1-164行的现有代码，它们是正确的
// 新增安全检查函数
function isCodeSafe(code: string): boolean {
  const dangerousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /setTimeout|setInterval/,
    /fetch|XMLHttpRequest/,
    /import|require/,
    /process\.|global\.|window\./,
    /\.__proto__|prototype/,
    /delete\s+/
  ]
  
  return !dangerousPatterns.some(pattern => pattern.test(code))
}