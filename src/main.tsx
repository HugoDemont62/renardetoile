import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Engine } from './lib/Engine.ts'
import { GameUI } from './components/GameUI.tsx'
import './index.css'

const engine = new Engine(document.body)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameUI engine={engine} />
  </StrictMode>,
)