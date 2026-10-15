
import { useEffect, useState } from 'react'
import {
  Activity, Bell, Check, ChevronRight, Heart, History,
  Mic, MicOff, Send, ShieldCheck, UserRound, Volume2
} from 'lucide-react'
import './App.css'

const STORAGE_KEY = 'saathi-checkins'

function readEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function App() {
  const [message, setMessage] = useState('')
  const [entries, setEntries] = useState(readEntries)
  const [analysis, setAnalysis] = useState(null)
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setNotice('Voice input is not supported in this browser. Please type your check-in instead.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
      setNotice('Listening… Please describe how you are feeling.')
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setMessage((previous) => previous ? `${previous} ${transcript}` : transcript)
      setNotice('Voice captured. Review your message before analysing it.')
    }

    recognition.onerror = () => {
      setNotice('Could not capture speech. You can type your check-in instead.')
    }

    recognition.onend = () => setListening(false)

    try {
      recognition.start()
    } catch {
      setListening(false)
      setNotice('Voice input could not start. Please try again or type your check-in.')
    }
  }

  async function analyseCheckIn(event) {
    event?.preventDefault()
    if (!message.trim() || busy) return

    setBusy(true)
    setNotice('Understanding your check-in…')

    try {
      const response = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      })

      if (response.ok) {
        const result = await response.json()
        setAnalysis(result)
        setNotice('Please review the extracted details before saving.')
      } else {
        throw new Error('AI service unavailable')
      }
    } catch {
      // Local fallback keeps the prototype usable if the AI server is not ready.
      setAnalysis({
        summary: message.trim(),
        symptom: extractSymptom(message),
        duration: extractDuration(message),
        severity: 'Not specified',
        guidance: 'Review your symptoms and contact a qualified healthcare professional if you are concerned.',
        source: 'local-fallback',
      })
      setNotice('Showing a basic local summary because the AI service is unavailable.')
    } finally {
      setBusy(false)
    }
  }

  function saveCheckIn() {
    if (!analysis) return

    const entry = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      ...analysis,
      summary: analysis.summary || message.trim(),
    }

    setEntries((previous) => [entry, ...previous])
    setAnalysis(null)
    setMessage('')
    setNotice('Your check-in has been saved on this device.')
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      setNotice('Read-aloud is not supported in this browser.')
      return
    }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
  }

  const latest = entries[0]

  return (
    <main className="saathi">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Saathi home">
          <span className="brand-icon"><Heart size={23} /></span>
          <span>saathi<span className="brand-dot">.</span>
            <small>Your caring health companion</small>
          </span>
        </a>
        <div className="top-actions">
          <button className="share-toggle" onClick={() => setSharing((value) => !value)}>
            <span className={`status-dot ${sharing ? 'active' : ''}`} />
            Sharing: {sharing ? 'On' : 'Off'}
          </button>
          <button className="icon-button" title="Read page introduction" onClick={() => speak('Welcome to Saathi, your caring health companion.')}>
            <Volume2 size={19} />
          </button>
        </div>
      </header>

      <section className="welcome" id="home">
        <div>
          <p className="eyebrow"><Heart size={15} /> A LITTLE CARE, EVERY DAY</p>
          <h1>Hello there. <span>How are you feeling?</span></h1>
          <p className="welcome-copy">Take a moment for yourself. Tell Saathi how your day is going, in your own words.</p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <Heart size={42} strokeWidth={1.4} />
          <span>You're not alone</span>
        </div>
      </section>

      <div className="content-grid">
        <section className="checkin-card">
          <div className="card-heading">
            <div className="heading-icon"><Mic size={21} /></div>
            <div>
              <h2>Daily voice check-in</h2>
              <p>Speak naturally or type below</p>
            </div>
            <span className="step-label">STEP 1 OF 2</span>
          </div>

          <div className="voice-panel">
            <button
              className={`mic-button ${listening ? 'listening' : ''}`}
              onClick={startVoiceInput}
              aria-label={listening ? 'Listening' : 'Start voice check-in'}
              disabled={listening}
            >
              {listening ? <MicOff size={29} /> : <Mic size={29} />}
            </button>
            <p className="voice-title">{listening ? 'I’m listening…' : 'Tap to talk to Saathi'}</p>
            <p className="voice-subtitle">For example: “My knee has been hurting for three days.”</p>
          </div>

          <form onSubmit={analyseCheckIn}>
            <label htmlFor="checkin-message">Your check-in</label>
            <textarea
              id="checkin-message"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell me how you are feeling today…"
            />
            <div className="form-footer">
              <span>{message.length} characters</span>
              <button className="primary-button" type="submit" disabled={!message.trim() || busy}>
                {busy ? 'Understanding…' : 'Understand my check-in'} <ChevronRight size={17} />
              </button>
            </div>
          </form>

          {notice && <p className="notice" role="status">{notice}</p>}

          {analysis && (
            <section className="analysis-panel" aria-live="polite">
              <div className="analysis-title">
                <Activity size={20} />
                <div><h3>Here is what I understood</h3><p>Please check that these details are correct.</p></div>
              </div>
              <p className="analysis-summary">{analysis.summary}</p>
              <div className="detail-grid">
                <Detail label="Symptom" value={analysis.symptom} />
                <Detail label="Duration" value={analysis.duration} />
                <Detail label="Severity" value={analysis.severity} />
              </div>
              <p className="guidance">{analysis.guidance}</p>
              <div className="analysis-actions">
                <button className="secondary-button" onClick={() => setAnalysis(null)}>Edit message</button>
                <button className="primary-button" onClick={saveCheckIn}><Check size={17} /> Confirm & save</button>
              </div>
            </section>
          )}
        </section>

        <aside className="side-column">
          <section className="side-card">
            <div className="side-title"><History size={19} /><h2>Recent check-ins</h2></div>
            {entries.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><Heart size={22} /></span>
                <p>Your check-in history will appear here.</p>
                <small>Your entries stay in this browser on this device.</small>
              </div>
            ) : (
              <div className="entry-list">
                {entries.slice(0, 4).map((entry) => (
                  <article className="entry" key={entry.id}>
                    <span className="entry-icon"><Activity size={17} /></span>
                    <div>
                      <strong>{entry.symptom || 'Daily check-in'}</strong>
                      <p>{new Date(entry.createdAt).toLocaleString()}</p>
                      <small>{entry.summary}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="side-card wellbeing-card">
            <div className="side-title"><ShieldCheck size={19} /><h2>Your wellbeing matters</h2></div>
            <p>Saathi helps you keep track of what you share. It does not diagnose illness or replace a healthcare professional.</p>
            <button className="read-button" onClick={() => speak('Saathi is a wellness tracking prototype, not a diagnostic tool. Please contact a healthcare professional for medical advice.')}>
              <Volume2 size={16} /> Read this aloud
            </button>
          </section>

          <section className="side-card privacy-card">
            <div className="side-title"><UserRound size={19} /><h2>Caregiver sharing</h2></div>
            <p>{sharing ? 'Sharing is marked as enabled for this demo. No message is sent to a caregiver.' : 'Sharing is off. Your entries remain on this device.'}</p>
            <button className="secondary-button" onClick={() => setSharing((value) => !value)}>
              {sharing ? 'Turn sharing off' : 'Enable demo sharing'}
            </button>
          </section>

          <section className="side-card latest-card">
            <div className="side-title"><Bell size={19} /><h2>Last saved entry</h2></div>
            {latest ? <p>{latest.symptom || latest.summary}</p> : <p>No saved check-in yet.</p>}
          </section>
        </aside>
      </div>

      <footer className="footer">
        <ShieldCheck size={17} />
        <p>Saathi is a wellness tracking prototype, not a medical device. It does not diagnose, predict emergencies, or send alerts.</p>
      </footer>
    </main>
  )
}

function Detail({ label, value }) {
  return <div className="detail-item"><span>{label}</span><strong>{value || 'Not identified'}</strong></div>
}

function extractSymptom(text) {
  const symptoms = ['knee pain', 'headache', 'fever', 'cough', 'dizziness', 'tiredness', 'pain', 'nausea', 'breathlessness']
  const match = symptoms.find((item) => text.toLowerCase().includes(item))
  return match || 'General wellbeing'
}

function extractDuration(text) {
  const match = text.match(/(?:for\s+)?(\d+\s+(?:day|days|week|weeks|month|months|hour|hours))/i)
  return match ? match[1] : 'Not specified'
}

export default App
