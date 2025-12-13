import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Send, ArrowLeft, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const Chat = () => {
  const { id } = useParams(); // Get Project ID from URL
  const { token, API_URL } = useAuth();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Hello! I have read your document. Ask me anything about it.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // 1. Add User Message
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // 2. Call Backend API
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ projectId: id, message: userMessage.content })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to get answer');

      // 3. Add AI Message
      setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', content: "⚠️ Sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center p-4 bg-gray-800 border-b border-gray-700 shadow-md">
        <button 
          onClick={() => navigate('/dashboard')}
          className="mr-4 p-2 hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-400" />
        </button>
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="text-blue-400" /> NexusMind AI
          </h1>
          <p className="text-xs text-gray-500">Chatting with Project ID: {id.slice(-4)}</p>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] p-4 rounded-2xl shadow-lg ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-none'
              }`}
            >
              <div className="flex items-center gap-2 mb-1 opacity-50 text-xs uppercase tracking-wider font-bold">
                {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                {msg.role === 'user' ? 'You' : 'AI'}
              </div>
              <div className="prose prose-invert text-sm leading-relaxed">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 p-4 rounded-2xl rounded-bl-none border border-gray-700 flex items-center gap-3">
              <Loader2 className="animate-spin text-blue-400" size={20} />
              <span className="text-gray-400 text-sm animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your document..."
            className="w-full p-4 pr-14 bg-gray-900 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-inner text-white placeholder-gray-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;