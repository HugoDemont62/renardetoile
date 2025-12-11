import { useState, useEffect } from 'react'
import { Engine } from '../lib/Engine'
import { Scene } from '../lib/Scene'

interface GameUIProps {
  engine: Engine
}

export function GameUI({ engine }: GameUIProps) {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('playing')
  const [score, setScore] = useState(0)
  const [finalScore, setFinalScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [combo, setCombo] = useState(1)
  const [shieldActive, setShieldActive] = useState(false)
  const [shieldTime, setShieldTime] = useState(0)
  const [rapidFireActive, setRapidFireActive] = useState(false)
  const [rapidFireTime, setRapidFireTime] = useState(0)

  const startGame = () => {
    setScore(0)
    setLives(3)
    setCombo(1)
    setShieldActive(false)
    setRapidFireActive(false)
    setGameState('playing')

    const scene = new Scene(engine)
    scene.onScoreUpdate = (s) => setScore(s)
    scene.onLivesUpdate = (l) => setLives(l)
    scene.onComboUpdate = (c) => setCombo(c)
    scene.onShieldUpdate = (active, time) => {
      setShieldActive(active)
      setShieldTime(time)
    }
    scene.onRapidFireUpdate = (active, time) => {
      setRapidFireActive(active)
      setRapidFireTime(time)
    }
    scene.onGameOver = () => {
      setFinalScore(score)
      setGameState('gameover')
    }
    engine.scene = scene
    engine.resize()
  }

  useEffect(() => {
    if (!engine.scene) startGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update final score when game over
  useEffect(() => {
    if (gameState === 'gameover') {
      setFinalScore(score)
    }
  }, [gameState, score])

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
        background: 'linear-gradient(180deg, #000033 0%, #000011 100%)',
        color: 'white',
        fontFamily: '"Press Start 2P", monospace',
        zIndex: 10
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: '3rem',
            marginBottom: '1rem',
            color: '#00ff00',
            textShadow: '0 0 20px #00ff00, 0 0 40px #00ff00'
          }}>
            ⭐ RENARD ÉTOILE ⭐
          </h1>
          <p style={{ fontSize: '0.8rem', marginBottom: '2rem', color: '#888' }}>
            Un hommage à Star Fox
          </p>

          <div style={{ marginBottom: '2rem', fontSize: '0.7rem', color: '#aaa', textAlign: 'left', maxWidth: '400px', margin: '0 auto 2rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>🎮 CONTRÔLES:</p>
            <p>ZQSD / Flèches - Déplacer</p>
            <p>E / Entrée - Tirer</p>
            <p>Espace - Accélérer</p>
            <p>Shift - Freiner</p>
          </div>

          <button
            onClick={startGame}
            style={{
              fontSize: '1.2rem',
              padding: '1rem 3rem',
              background: 'linear-gradient(180deg, #00ff00 0%, #008800 100%)',
              color: 'black',
              border: 'none',
              cursor: 'pointer',
              fontFamily: '"Press Start 2P", monospace',
              fontWeight: 'bold',
              boxShadow: '0 0 20px #00ff00',
              transition: 'transform 0.1s, box-shadow 0.1s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 0 30px #00ff00'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 0 20px #00ff00'
            }}
          >
            JOUER
          </button>
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
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        fontFamily: '"Press Start 2P", monospace',
        zIndex: 10
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: '2.5rem',
            marginBottom: '1rem',
            color: '#ff0000',
            textShadow: '0 0 20px #ff0000',
            animation: 'pulse 1s infinite'
          }}>
            💥 GAME OVER 💥
          </h1>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#ffff00' }}>
            SCORE FINAL
          </p>
          <p style={{
            fontSize: '2rem',
            marginBottom: '2rem',
            color: '#00ffff',
            textShadow: '0 0 10px #00ffff'
          }}>
            {finalScore.toLocaleString()}
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={startGame}
              style={{
                fontSize: '1rem',
                padding: '0.8rem 2rem',
                background: 'linear-gradient(180deg, #00ff00 0%, #008800 100%)',
                color: 'black',
                border: 'none',
                cursor: 'pointer',
                fontFamily: '"Press Start 2P", monospace',
                fontWeight: 'bold'
              }}
            >
              REJOUER
            </button>
            <button
              onClick={returnToMenu}
              style={{
                fontSize: '1rem',
                padding: '0.8rem 2rem',
                background: 'linear-gradient(180deg, #666 0%, #333 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontFamily: '"Press Start 2P", monospace'
              }}
            >
              MENU
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Playing state - HUD
  return (
    <>
      {/* Score et Combo - En haut à gauche */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        color: '#00ff00',
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '1rem',
        zIndex: 10,
        textShadow: '2px 2px 4px black, 0 0 10px #00ff00'
      }}>
        <div>SCORE: {score.toLocaleString()}</div>
        {combo > 1 && (
          <div style={{
            color: '#ffff00',
            fontSize: '0.8rem',
            marginTop: '5px',
            animation: 'pulse 0.5s infinite'
          }}>
            COMBO x{combo}
          </div>
        )}
      </div>

      {/* Vies - En haut à droite */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '1.2rem',
        zIndex: 10,
        textShadow: '2px 2px 4px black'
      }}>
        {Array.from({ length: lives }).map((_, i) => (
          <span key={i} style={{ color: '#ff0066' }}>❤️</span>
        ))}
        {Array.from({ length: Math.max(0, 3 - lives) }).map((_, i) => (
          <span key={`empty-${i}`} style={{ color: '#333', opacity: 0.5 }}>🖤</span>
        ))}
      </div>

      {/* Power-ups actifs - En bas à gauche */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '0.7rem',
        zIndex: 10
      }}>
        {shieldActive && (
          <div style={{
            background: 'rgba(0, 255, 255, 0.3)',
            border: '2px solid #00ffff',
            padding: '8px 12px',
            marginBottom: '8px',
            color: '#00ffff',
            textShadow: '0 0 5px #00ffff'
          }}>
            🛡️ SHIELD: {Math.ceil(shieldTime)}s
          </div>
        )}
        {rapidFireActive && (
          <div style={{
            background: 'rgba(255, 255, 0, 0.3)',
            border: '2px solid #ffff00',
            padding: '8px 12px',
            color: '#ffff00',
            textShadow: '0 0 5px #ffff00'
          }}>
            ⚡ RAPID FIRE: {Math.ceil(rapidFireTime)}s
          </div>
        )}
      </div>

      {/* Instructions - En bas au centre */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '0.5rem',
        color: 'rgba(255, 255, 255, 0.5)',
        zIndex: 10,
        textAlign: 'center'
      }}>
        ZQSD: Bouger | E: Tirer | Espace: Accélérer
      </div>

      {/* Style pour l'animation pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
      `}</style>
    </>
  )
}
