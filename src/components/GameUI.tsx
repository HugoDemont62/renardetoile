import { useState, useEffect } from 'react'
import { Engine } from '../lib/Engine'
import { Scene } from '../lib/Scene'

interface GameUIProps {
  engine: Engine
}

export function GameUI({ engine }: GameUIProps) {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('playing') // démarrage direct
  const [score, setScore] = useState(0)
  const [finalScore, setFinalScore] = useState(0)

  const startGame = () => {
    setScore(0)
    setGameState('playing')

    const scene = new Scene(engine)
    scene.onScoreUpdate = (s) => setScore(s)
    scene.onGameOver = () => {
      setFinalScore(() => {
        const currentScore = score
        setGameState('gameover')
        return currentScore
      })
    }
    engine.scene = scene
    engine.resize()
  }

  useEffect(() => {
    // démarre automatiquement une seule fois au montage
    if (!engine.scene) startGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const returnToMenu = () => {
    if (engine.scene) {
      engine.scene.dispose()
    }
    setGameState('menu')
  }

  if (gameState === 'menu') {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        fontFamily: 'monospace',
        zIndex: 10
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '4rem', marginBottom: '2rem', color: '#00ff00' }}>Renard Etoile</h1>
          <button onClick={startGame}>START GAME</button>
        </div>
      </div>
    )
  }

  if (gameState === 'gameover') {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        fontFamily: 'monospace',
        zIndex: 10
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '2rem', color: '#ff0000' }}>GAME OVER</h1>
          <p style={{ fontSize: '2rem', marginBottom: '2rem' }}>Score: {finalScore}</p>
          <button onClick={returnToMenu} style={{
            fontSize: '1.5rem',
            padding: '1rem 3rem',
            background: '#00ff00',
            color: 'black',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold'
          }}>
            MENU
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '20px',
      color: '#00ff00',
      fontFamily: 'monospace',
      fontSize: '1.5rem',
      zIndex: 10,
      textShadow: '2px 2px 4px black'
    }}>
      SCORE: {score}
    </div>
  )
}
