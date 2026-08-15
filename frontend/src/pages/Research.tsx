import { useState } from 'react'
import Button from '../components/Button'
import Input from '../components/Input'
import { useAuth } from '../context/AuthContext'

function Research() {
  const { user } = useAuth()
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)

  const onStart = async () => {
    if (!topic.trim()) {
      return
    }

    setLoading(true)

    await new Promise((resolve) => {
      setTimeout(resolve, 700)
    })

    setStarted(true)
    setLoading(false)
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Private Research</h1>
        <p className="mt-2 text-sm text-[#999999]">Your research workspace is protected.</p>
      </header>

      <div className="border border-[#222222] bg-[#111111] p-6">
        <div className="space-y-4">
          <Input
            label="What do you want to research?"
            placeholder="What do you want to research?"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />
          <Button onClick={() => void onStart()} loading={loading}>
            {loading ? 'Starting research...' : 'Start Research'}
          </Button>
        </div>
      </div>

      {started ? (
        <div className="border border-[#222222] bg-[#111111] p-6 animate-fade-in">
          <p className="text-base">Research started.</p>
          <p className="mt-2 text-sm text-[#999999]">Your authenticated session is working correctly.</p>

          <div className="mt-6 space-y-2 text-sm">
            <p>
              Authentication status: <span className="text-white">● Authenticated</span>
            </p>
            <p>
              User: <span className="text-white">{user?.email}</span>
            </p>
            <p>
              User ID: <span className="text-white">{user?.id}</span>
            </p>
            <p>
              Token: <span className="text-white">JWT authenticated</span>
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default Research
