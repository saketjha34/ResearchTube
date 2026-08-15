import { useMemo, useState } from 'react'
import Button from '../components/Button'
import Input from '../components/Input'
import { useAuth } from '../context/AuthContext'

const initialResearch = [
  'Deep dive on recommender systems in long-form video',
  'AI interpretability interviews and benchmarks',
  'Economic history perspectives from lecture channels',
]

function Dashboard() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')

  const greetingName = useMemo(() => {
    const source = user?.full_name || user?.username || 'Researcher'
    return source.split(' ')[0]
  }, [user])

  return (
    <section className="space-y-10">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">Good morning, {greetingName}</h1>
        <p className="mt-2 text-sm text-[#999999]">Continue your research.</p>
      </header>

      <div className="border border-[#222222] bg-[#111111] p-6">
        <label className="mb-3 block text-xs tracking-[0.28em] text-[#999999]">RESEARCH</label>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            label="What are you researching?"
            placeholder="What are you researching?"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="md:flex-1"
          />
          <div className="md:pt-7">
            <Button>{'Search'}</Button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl">Recent Research</h2>
        <ul className="mt-5 space-y-3">
          {initialResearch.map((item) => (
            <li key={item} className="border border-[#181818] bg-[#111111] px-4 py-3 text-sm text-[#cfcfcf]">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default Dashboard
