import { useState, useEffect, useRef } from 'react'
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
  const [comboPulse, setComboPulse] = useState(false)
  const [showBigCombo, setShowBigCombo] = useState(false)
  const [shieldActive, setShieldActive] = useState(false)
  const [shieldTime, setShieldTime] = useState(0)
  const [rapidFireActive, setRapidFireActive] = useState(false)
  const [rapidFireTime, setRapidFireTime] = useState(0)
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sceneRef = useRef<Scene | null>(null)

  // notifications / toasts
  const [notifications, setNotifications] = useState<Array<{ id: number; text: string }>>([])
  const nextNotifId = useRef(1)

  // Crosshair position (screen coords). It will be computed from the starship forward vector
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number } | null>(null)
  const [crosshairColor, setCrosshairColor] = useState<string>('rgba(255,0,0,0.95)')

  // Update crosshair each frame so it points where the ship is aiming.
  // We project a world-space point (ship position + forward * distance) into screen space.
  useEffect(() => {
    let mounted = true
    let raf = 0

    const update = () => {
      if (!mounted) return
      const s: Scene | undefined = sceneRef.current ?? engine.scene
      if (s && s.starship && s.camera) {
        try {
          // Reproduire la position de spawn (z - 2) puis projeter un point loin devant pour visualiser la direction
          const shipPos = s.starship.getPosition()
          // utiliser la même direction que dans Scene.shoot() (direction du vaisseau)
          const forward = s.starship.getForward().clone().normalize()
          const spawnPos = shipPos.clone()
          spawnPos.z -= 2
          // distance choisie pour représenter la zone où les lasers passent (≈ portée visible)
          const target = spawnPos.clone().add(forward.clone().multiplyScalar(40))

          // s'assurer que la caméra a ses matrices à jour avant la projection
          s.camera.updateMatrixWorld(true)
          // projection en NDC via la caméra
          const ndc = target.clone().project(s.camera)

          // récupérer la taille et la position du canvas (CSS pixels)
          const canvas = (engine && (engine as any).renderer && (engine as any).renderer.domElement) as HTMLCanvasElement | undefined
          let rectLeft = 0
          let rectTop = 0
          let vw = (globalThis.innerWidth || window.innerWidth)
          let vh = (globalThis.innerHeight || window.innerHeight)
          if (canvas) {
            const rect = canvas.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
              vw = rect.width
              vh = rect.height
              rectLeft = rect.left
              rectTop = rect.top
            }
          }

          // detecter hors-écran
          const offscreen = ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1 || ndc.z > 1

          // Convertir NDC -> coordonnées CSS du canvas
          let x = (ndc.x + 1) * 0.5 * vw + rectLeft
          let y = (1 - (ndc.y + 1) * 0.5) * vh + rectTop

          // clamp pour rester visible
          const margin = 8
          const minX = rectLeft + margin
          const maxX = rectLeft + vw - margin
          const minY = rectTop + margin
          const maxY = rectTop + vh - margin
          x = Math.max(minX, Math.min(x, maxX))
          y = Math.max(minY, Math.min(y, maxY))

          setCrosshairPos({ x: Math.round(x), y: Math.round(y) })
          setCrosshairColor(offscreen ? 'rgba(255,200,0,0.95)' : 'rgba(255,0,0,0.95)')
        } catch (err) {
          console.warn('Crosshair projection failed', err)
          setCrosshairPos({ x: Math.round((globalThis.innerWidth || window.innerWidth) / 2), y: Math.round((globalThis.innerHeight || window.innerHeight) / 2) })
          setCrosshairColor('rgba(255,0,0,0.95)')
        }
      } else {
        // default center until scene/ship ready
        setCrosshairPos({ x: Math.round((globalThis.innerWidth || window.innerWidth) / 2), y: Math.round((globalThis.innerHeight || window.innerHeight) / 2) })
        setCrosshairColor('rgba(255,0,0,0.95)')
      }
      raf = requestAnimationFrame(update)
    }

    raf = requestAnimationFrame(update)
    return () => {
      mounted = false
      cancelAnimationFrame(raf)
    }
  }, [engine])

  const startGame = () => {
    setScore(0)
    setLives(3)
    setCombo(1)
    setShieldActive(false)
    setRapidFireActive(false)
    setGameState('playing')

    const scene = new Scene(engine)
    sceneRef.current = scene
    scene.onScoreUpdate = (s) => setScore(s)
    scene.onLivesUpdate = (l) => setLives(l)
    scene.onComboUpdate = (c) => setCombo(c)
    scene.onPowerUpCollected = (type) => {
      // map type to friendly text
      const label: Record<string, string> = {
        health: '❤️ Health',
        rapidfire: '⚡ Rapid Fire',
        shield: '🛡️ Shield',
        score: '⭐ Score Bonus'
      }
      addNotification(label[type] || `+ ${String(type)}`)
    }
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

  // pulse animation when combo changes
  useEffect(() => {
    if (combo > 1) {
      setComboPulse(true)
      setShowBigCombo(true)
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
      comboTimerRef.current = setTimeout(() => {
        setComboPulse(false)
        setShowBigCombo(false)
        comboTimerRef.current = null
      }, 700)
    }
    return () => { if (comboTimerRef.current) clearTimeout(comboTimerRef.current) }
  }, [combo])

  // Add notification helper
  function addNotification(text: string, duration = 2500) {
    const id = nextNotifId.current++
    setNotifications((s) => [...s, { id, text }])
    setTimeout(() => {
      setNotifications((s) => s.filter(n => n.id !== id))
    }, duration)
  }

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
      {/* Notifications (toasts) - top center */}
      <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
        {notifications.map(n => (
          <div key={n.id} style={{
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '8px 14px',
            marginBottom: '8px',
            borderRadius: '8px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '0.75rem',
            opacity: 0.95
          }}>{n.text}</div>
        ))}
      </div>

      {/* Big centered combo when active */}
      {showBigCombo && combo > 1 && (
        <div style={{ position: 'fixed', left: '50%', top: '30%', transform: 'translate(-50%, -50%)', zIndex: 40, pointerEvents: 'none' }}>
          <div style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '2.4rem',
            color: '#ffec00',
            textAlign: 'center',
            textShadow: '0 0 20px #ffec00, 0 0 40px #ff6600',
            transform: comboPulse ? 'scale(1.35)' : 'scale(1)',
            transition: 'transform 0.12s ease-out'
          }}>COMBO x{combo}</div>
          <div style={{ textAlign: 'center', color: '#ffd700', fontFamily: '"Press Start 2P", monospace', marginTop: '6px' }}>+{Math.floor((combo - 1) * 50)}% BONUS</div>
        </div>
      )}

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
            fontSize: '1.1rem',
            marginTop: '5px',
            transform: comboPulse ? 'scale(1.45)' : 'scale(1)',
            transformOrigin: 'left top',
            transition: 'transform 0.15s ease-out, text-shadow 0.15s ease-out',
            textShadow: comboPulse ? '0 0 14px #ffff66, 0 0 30px #ffcc00' : '0 0 10px #ffff66'
          }}>
            <div style={{ fontWeight: 'bold' }}>COMBO x{combo}</div>
            <div style={{ fontSize: '0.7rem', color: '#ffd700', marginTop: '2px' }}>
              BONUS +{Math.floor((combo - 1) * 50)}%
            </div>
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

      {/* Crosshair - indique la direction de tir (point devant le vaisseau projeté à l'écran) */}
      {crosshairPos && (
        <div style={{
          position: 'fixed',
          left: crosshairPos.x,
          top: crosshairPos.y,
          transform: 'translate(-50%, -50%)',
          width: '40px',
          height: '40px',
          pointerEvents: 'none',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* vertical line */}
          <div style={{ position: 'absolute', width: '2px', height: '28px', background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 8px rgba(255,255,255,0.15)' }} />
          {/* horizontal line */}
          <div style={{ position: 'absolute', height: '2px', width: '28px', background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 8px rgba(255,255,255,0.15)' }} />
          {/* center ring (couleur dynamique) */}
          <div style={{ position: 'absolute', width: '10px', height: '10px', borderRadius: '50%', border: `2px solid ${crosshairColor}`, boxSizing: 'border-box', background: 'transparent', boxShadow: `0 0 10px ${crosshairColor}` }} />
        </div>
      )}

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
