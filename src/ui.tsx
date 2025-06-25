import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { render, Container, VerticalSpace, Text, Button } from '@create-figma-plugin/ui'

const OPENROUTER_KEY = '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'

async function askAI(prompt: string) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': 'https://figma.com',
      'X-Title': 'Figma-Pilot'
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat-v3-0324',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '你是Figma插件的JavaScript代码生成器。根据用户的自然语言指令，生成可直接执行的JavaScript代码来操作Figma API。\n' +
            '返回格式：{"code": "你的JavaScript代码"}\n' +
            '可用的全局变量：\n' +
            '- figma: Figma API对象\n' +
            '- selection: 当前选中的节点数组 (figma.currentPage.selection)\n' +
            '\n操作规则：\n' +
            '1. 修改现有对象：只修改已存在的属性，不添加新属性\n' +
            '2. 创建新对象：可以设置所需的所有属性\n' +
            '3. 明确要求添加效果：如用户明确说"添加阴影"、"加个边框"等，可以添加相应属性\n' +
            '4. 修改颜色：检查fills或strokes是否存在，只修改已有的\n' +
            '\n示例：\n' +
            '用户说"圆角改成20" → {"code": "selection.forEach(node => { if(\'cornerRadius\' in node) node.cornerRadius = 20 })"}\n' +
            '用户说"颜色改成红色" → {"code": "selection.forEach(node => { if(node.fills && node.fills.length > 0) { node.fills = [{...node.fills[0], color: {r: 1, g: 0, b: 0}}] } if(node.strokes && node.strokes.length > 0) { node.strokes = [{...node.strokes[0], color: {r: 1, g: 0, b: 0}}] } })"}\n' +
            '用户说"添加红色边框" → {"code": "selection.forEach(node => { if(\'strokes\' in node) { node.strokes = [{type: \'SOLID\', color: {r: 1, g: 0, b: 0}}]; node.strokeWeight = 1 } })"}\n' +
            '用户说"创建一个红色圆形" → {"code": "const circle = figma.createEllipse(); circle.fills = [{type: \'SOLID\', color: {r: 1, g: 0, b: 0}}]; figma.currentPage.appendChild(circle)"}\n' +
            '\n注意：\n' +
            '1. 只生成安全的Figma API调用\n' +
            '2. 包含必要的类型检查和错误处理\n' +
            '3. 代码应该简洁高效\n' +
            '4. 不要使用eval、Function构造器等危险操作'
        },
        { role: 'user', content: prompt }
      ]
    })
  })
  const data = await res.json()
  return data.choices[0].message.content
}

function App() {
  const [count, setCount] = useState(0)
  const [cmd, setCmd] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lastCode, setLastCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'get-count' } }, '*')
    window.onmessage = (e) => {
      const m = e.data.pluginMessage
      if (m?.type === 'count') setCount(m.count)
    }
  }, [])

  async function run() {
    if (!cmd.trim()) return
    setIsLoading(true)
    setError('')
    
    try {
      const jsonStr = await askAI(cmd.trim())
      const parsed = JSON.parse(jsonStr)
      setLastCode(parsed.code)
      
      parent.postMessage({ pluginMessage: { type: 'apply-ai', payload: jsonStr } }, '*')
      setCmd('')
    } catch (err: any) {
      setError('AI调用失败: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container space="extraSmall" style={{ padding: 16, height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <Text style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{`已选中 ${count} 个对象`}</Text>
      <textarea
        placeholder="输入指令，例如：圆角改成 20"
        style={{ 
          width: '100%', 
          flex: 1, 
          resize: 'none', 
          padding: 8, 
          fontSize: 14, 
          borderRadius: 4, 
          border: 'none', 
          background: 'var(--figma-color-bg-secondary)', 
          color: 'var(--figma-color-text)',
          marginBottom: 16,
          boxSizing: 'border-box',
          cursor: 'text'
        }}
        value={cmd}
        onInput={(e: any) => setCmd((e.target as HTMLTextAreaElement).value)}
        onKeyDown={(e: any) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            run()
          }
        }}
      />
      
      {lastCode && (
        <details style={{ marginTop: 8, fontSize: 12, marginBottom: 8 }}>
          <summary>查看生成的代码</summary>
          <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, overflow: 'auto', fontSize: 11 }}>
            {lastCode}
          </pre>
        </details>
      )}
      
      {error && (
        <Text style={{ color: 'red', fontSize: 12, marginBottom: 8 }}>{error}</Text>
      )}
      
      <Button fullWidth onClick={run} disabled={isLoading} style={{ fontSize: 16, height: 40 }}>
        {isLoading ? '执行中...' : '执行'}
      </Button>
    </Container>
  )
}

export default render(App)
