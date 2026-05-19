import { useState, useEffect, useRef } from 'react'
import Draggable from 'react-draggable'
import { useNavigate } from 'react-router-dom'
import { getTodos, createTodo, updateTodo, deleteTodo, getStudents } from '../api'
import type { Todo, Student } from '../types'
import './FloatingTodoWidget.css'

export default function FloatingTodoWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [todos, setTodos] = useState<Todo[]>([])
  const [students, setStudents] = useState<Student[]>([])
  
  const [text, setText] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  
  // Mention Dropdown state
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadTodos()
    getStudents().then(setStudents).catch(console.error)
  }, [])

  const loadTodos = async () => {
    try {
      const data = await getTodos()
      setTodos(data)
    } catch (e) {
      console.error('Failed to load todos', e)
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setText(val)

    // Check if the user is currently typing a mention
    const words = val.split(' ')
    const lastWord = words[words.length - 1]
    
    if (lastWord.startsWith('@')) {
      setMentionFilter(lastWord.slice(1).toLowerCase())
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }
    
    // If user deletes the mention, clear selected student
    if (selectedStudent && !val.includes(`@${selectedStudent.name.replace(/\s+/g, '_')}`)) {
      setSelectedStudent(null)
    }
  }

  const selectMention = (student: Student) => {
    const words = text.split(' ')
    words.pop() // remove the partial @mention
    const mentionTag = `@${student.name.replace(/\s+/g, '_')}`
    words.push(mentionTag)
    
    setText(words.join(' ') + ' ')
    setSelectedStudent(student)
    setShowMentions(false)
    inputRef.current?.focus()
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    
    try {
      const newTodo = await createTodo({
        text: text.trim(),
        studentId: selectedStudent?.id || null
      })
      setTodos([newTodo, ...todos])
      setText('')
      setSelectedStudent(null)
    } catch (err) {
      console.error(err)
    }
  }

  const toggleTodo = async (todo: Todo) => {
    const newStatus = !todo.isCompleted
    setTodos(todos.map(t => t.id === todo.id ? { ...t, isCompleted: newStatus } : t))
    await updateTodo(todo.id, { isCompleted: newStatus })
  }

  const removeTodo = async (id: number) => {
    setTodos(todos.filter(t => t.id !== id))
    await deleteTodo(id)
  }

  const handleTagClick = (e: React.MouseEvent, studentId: number) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(false)
    navigate(`/students?highlightId=${studentId}`)
  }

  const renderText = (todo: Todo) => {
    if (!todo.student) return <span>{todo.text}</span>
    
    const tag = `@${todo.student.name.replace(/\s+/g, '_')}`
    const parts = todo.text.split(tag)
    
    if (parts.length === 1) return <span>{todo.text}</span> // tag not exactly found
    
    return (
      <span>
        {parts[0]}
        <button className="todo-mention-tag" onClick={(e) => handleTagClick(e, todo.student!.id)}>
          {tag}
        </button>
        {parts[1]}
      </span>
    )
  }

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(mentionFilter)).slice(0, 5)

  return (
    <Draggable handle=".widget-handle" bounds="body" defaultPosition={{x: window.innerWidth - 350, y: window.innerHeight - 500}}>
      <div className="floating-widget-container">
        {isOpen && (
          <div className="widget-panel">
            <div className="widget-handle">
              <span>📋 To-Do List</span>
              <button onClick={() => setIsOpen(false)} className="close-btn">✕</button>
            </div>
            
            <div className="widget-body">
              <div className="todo-list">
                {todos.map(todo => (
                  <div key={todo.id} className={`todo-item ${todo.isCompleted ? 'completed' : ''}`}>
                    <input 
                      type="checkbox" 
                      checked={todo.isCompleted} 
                      onChange={() => toggleTodo(todo)} 
                      className="todo-checkbox"
                    />
                    <div className="todo-text">
                      {renderText(todo)}
                    </div>
                    <button className="todo-delete" onClick={() => removeTodo(todo.id)}>✕</button>
                  </div>
                ))}
                {todos.length === 0 && <div className="todo-empty">No tasks yet!</div>}
              </div>
            </div>

            <div className="widget-footer">
              <form onSubmit={handleAdd} className="todo-form">
                <div className="mention-wrapper">
                  <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={handleTextChange}
                    placeholder="Add task... (type @ for student)"
                    className="todo-input"
                  />
                  {showMentions && filteredStudents.length > 0 && (
                    <div className="mention-dropdown">
                      {filteredStudents.map(s => (
                        <div key={s.id} className="mention-option" onClick={() => selectMention(s)}>
                          <span className="mention-name">{s.name}</span>
                          {s.instrument && <span className="mention-inst">{s.instrument}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="submit" className="todo-submit" disabled={!text.trim()}>+</button>
              </form>
            </div>
          </div>
        )}
        
        {!isOpen && (
          <button className="widget-fab" onClick={() => setIsOpen(true)}>
            📋
          </button>
        )}
      </div>
    </Draggable>
  )
}
