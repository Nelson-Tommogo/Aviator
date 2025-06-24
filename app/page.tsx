"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Volume2, VolumeX, User, Menu, Info, X } from "lucide-react"
import Link from "next/link"

interface Bet {
  id: string
  player: string
  amount: number
  multiplier: number
  winAmount: number
  status: "win" | "loss"
  timestamp: Date
}

interface CashoutHistory {
  id: string
  player: string
  avatar: string
  amount: number
  multiplier: number
  winAmount: number
  timestamp: Date
  timeAgo: string
}

export default function JetWinAviator() {
  const [gameState, setGameState] = useState<"waiting" | "flying" | "crashed">("waiting")
  const [multiplier, setMultiplier] = useState(1.0)
  const [betAmount, setBetAmount] = useState(10.5) // $10.50
  const [autoCashout, setAutoCashout] = useState(1.1)
  const [balance, setBalance] = useState(0)
  const [allBets, setAllBets] = useState<Bet[]>([])
  const [previousBets, setPreviousBets] = useState<Bet[]>([])
  const [topBets, setTopBets] = useState<Bet[]>([])
  const [cashoutHistory, setCashoutHistory] = useState<CashoutHistory[]>([])
  const [betActive, setBetActive] = useState(false)
  const [betCashed, setBetCashed] = useState(false)
  const [activeTab, setActiveTab] = useState("All Bets")
  const [autoBet, setAutoBet] = useState(false)
  const [autoCash, setAutoCash] = useState(false)
  const [betMode, setBetMode] = useState<"bet" | "auto">("bet")
  const [showRules, setShowRules] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [previousMultipliers, setPreviousMultipliers] = useState<number[]>([])
  const [musicEnabled, setMusicEnabled] = useState(true)
  const [audioInitialized, setAudioInitialized] = useState(false)
  const [showSoundModal, setShowSoundModal] = useState(false)
  const [showTopCashouts, setShowTopCashouts] = useState(false)
  const [graphData, setGraphData] = useState<{x: number, y: number}[]>([])
  const [maxMultiplier, setMaxMultiplier] = useState(10)
  const [profile, setProfile] = useState<any>(null)
  const [greetingName, setGreetingName] = useState("")
  const [depositAmount, setDepositAmount] = useState<number | null>(null)

  const audioRef = useRef<HTMLAudioElement>(null)
  const crashAudioRef = useRef<HTMLAudioElement>(null)
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const dataUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const crashPointRef = useRef<number>(1.0)
  const manualCashoutRef = useRef<boolean>(false)
  const welcomeAudioRef = useRef<HTMLAudioElement>(null)
  const flewAudioRef = useRef<HTMLAudioElement>(null)
  const gameCanvasRef = useRef<HTMLDivElement>(null)

  // Generate anonymous player name
  const generatePlayerName = () => {
    const firstDigit = Math.floor(Math.random() * 9) + 1
    const lastDigit = Math.floor(Math.random() * 10)
    return `${firstDigit}****${lastDigit}`
  }

  // Generate time ago string
  const generateTimeAgo = () => {
    const timeOptions = [
      "1 min ago",
      "2 mins ago",
      "3 mins ago",
      "4 mins ago",
      "5 mins ago",
      "6 mins ago",
      "7 mins ago",
      "8 mins ago",
      "9 mins ago",
      "10 mins ago",
      "15 mins ago",
      "20 mins ago",
      "30 mins ago",
      "45 mins ago",
      "1 hour ago",
    ]
    return timeOptions[Math.floor(Math.random() * timeOptions.length)]
  }

  // Initialize audio with better web compatibility
  const initializeAudio = useCallback(async () => {
    if (!audioInitialized) {
      try {
        if (audioRef.current) {
          audioRef.current.volume = 0.3
          audioRef.current.muted = false
          audioRef.current.loop = true
          const playPromise = audioRef.current.play()
          if (playPromise !== undefined) {
            await playPromise
            audioRef.current.pause()
            audioRef.current.currentTime = 0
          }
        }
        if (crashAudioRef.current) {
          crashAudioRef.current.volume = 0.5
          crashAudioRef.current.muted = false
        }
        setAudioInitialized(true)
        console.log("Audio initialized successfully")
      } catch (error) {
        console.log("Audio initialization failed:", error)
        setTimeout(() => {
          if (!audioInitialized) {
            initializeAudio()
          }
        }, 1000)
      }
    }
  }, [audioInitialized])

  // Load previous multipliers from localStorage
  useEffect(() => {
    // Load previous multipliers
    const stored = localStorage.getItem("jetcash-multipliers")
    if (stored) {
      setPreviousMultipliers(JSON.parse(stored))
    } else {
      const initial = [2.01, 1.01, 1.28, 2.72, 1.27, 1.41, 2.74, 1.05, 1.52, 7.35, 1.84, 2.21, 2.83, 4.32, 1.23]
      setPreviousMultipliers(initial)
      localStorage.setItem("jetcash-multipliers", JSON.stringify(initial))
    }

    // --- NEW LOGIC: Auth check and profile fetch ---
    const token = localStorage.getItem("token")
    if (token) {
      fetch("https://av-backend-qp7e.onrender.com/api/auth/me", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
      })
        .then(res => {
          if (!res.ok) throw new Error("Not authenticated")
          return res.json()
        })
        .then(() => {
          // Authenticated, now fetch profile
          fetch("https://av-backend-qp7e.onrender.com/api/users/profile", {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` },
          })
            .then(res => res.json())
            .then(data => {
              setProfile(data)
              if (data.lastname) {
                setGreetingName(data.lastname)
              } else {
                setGreetingName("")
              }
              if (data.email) {
                setUserEmail(data.email)
                setIsAdmin(data.email === "admin@gmail.com")
                // Fetch deposit amount by email
                fetch("https://av-backend-qp7e.onrender.com/api/deposits/by-email", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                  },
                  body: JSON.stringify({ email: data.email }),
                })
                  .then(res => res.json())
                  .then(dep => {
                    // Sum both amount and deposit if both exist
                    let total = 0;
                    if (typeof dep.amount === "number") total += dep.amount;
                    if (typeof dep.deposit === "number") total += dep.deposit;
                    if (total > 0) {
                      setDepositAmount(total);
                      setBalance(total);
                    }
                  })
                  .catch(() => {})
              }
            })
            .catch(() => {
              setProfile(null)
              setGreetingName("")
            })
        })
        .catch(() => {
          setProfile(null)
          setGreetingName("")
        })
    } else {
      setProfile(null)
      setGreetingName("")
    }

    // Load music preference
    const musicPref = localStorage.getItem("jetcash-music-enabled")
    if (musicPref !== null) {
      setMusicEnabled(JSON.parse(musicPref))
    }

    // Initialize audio on multiple events
    const events = ["click", "touchstart", "keydown", "scroll"]
    const handleUserInteraction = () => {
      initializeAudio()
      events.forEach((event) => {
        document.removeEventListener(event, handleUserInteraction)
      })
    }

    events.forEach((event) => {
      document.addEventListener(event, handleUserInteraction, { once: true })
    })

    setTimeout(initializeAudio, 2000)

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleUserInteraction)
      })
    }
  }, [initializeAudio])

  // Save multipliers to localStorage whenever they change
  useEffect(() => {
    if (previousMultipliers.length > 0) {
      localStorage.setItem("jetcash-multipliers", JSON.stringify(previousMultipliers))
    }
  }, [previousMultipliers])

  // Save music preference
  useEffect(() => {
    localStorage.setItem("jetcash-music-enabled", JSON.stringify(musicEnabled))
  }, [musicEnabled])

  // Generate dynamic bet amount
  const generateDynamicBetAmount = () => {
    const amounts = [
      5.5, 10.25, 15.75, 20.0, 25.5, 50.0, 75.25, 100.0, 150.5, 200.75, 300.0, 500.25, 750.5, 1000.0, 1500.75, 2000.0,
      3000.5, 5000.0, 7500.25, 10000.0,
    ]
    return amounts[Math.floor(Math.random() * amounts.length)]
  }

  // Generate massive dummy data with dynamic values
  const generateDummyData = useCallback(() => {
    const bets: Bet[] = []
    const cashouts: CashoutHistory[] = []

    for (let i = 0; i < 10000; i++) {
      const player = generatePlayerName()
      const amount = generateDynamicBetAmount()
      const multiplier = Math.random() * 100 + 1
      const status = Math.random() > 0.4 ? "win" : "loss"
      const winAmount = status === "win" ? amount * multiplier : 0

      bets.push({
        id: `bet-${i}`,
        player,
        amount,
        multiplier: Number(multiplier.toFixed(2)),
        winAmount: Number(winAmount.toFixed(2)),
        status,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 30),
      })
    }

    // Generate cashout history using recent multipliers
    const avatars = [
      "🎮",
      "🚀",
      "⭐",
      "🔥",
      "💎",
      "🎯",
      "⚡",
      "🌟",
      "🎲",
      "🏆",
      "🎪",
      "🎨",
      "🎭",
      "🎸",
      "🎺",
      "🎻",
      "🎤",
      "🎧",
      "🎬",
      "📱",
      "🦄",
      "🐉",
      "🦋",
      "🌈",
      "🎊",
      "🎉",
      "💫",
      "✨",
      "🌙",
      "☀️",
    ]

    // Use recent multipliers for realistic cashout history
    const recentMultipliers = [2.01, 1.01, 1.28, 2.72, 1.27, 1.41, 2.74, 1.05, 1.52, 7.35, 1.84, 2.21, 2.83, 4.32, 1.23]

    for (let i = 0; i < 1000; i++) {
      const player = generatePlayerName()
      const avatar = avatars[Math.floor(Math.random() * avatars.length)]
      const amount = generateDynamicBetAmount()
      // Use recent multipliers for more realistic history
      const multiplier = i < recentMultipliers.length ? recentMultipliers[i] : Math.random() * 50 + 1.1
      const winAmount = amount * multiplier

      cashouts.push({
        id: `cashout-${i}`,
        player,
        avatar,
        amount,
        multiplier: Number(multiplier.toFixed(2)),
        winAmount: Number(winAmount.toFixed(2)),
        timestamp: new Date(Date.now() - Math.random() * 3600000), // Within last hour
        timeAgo: generateTimeAgo(),
      })
    }

    setAllBets(bets)
    setPreviousBets(bets.filter((bet) => bet.status === "win").slice(0, 2000))
    setTopBets(bets.sort((a, b) => b.winAmount - a.winAmount).slice(0, 1000))
    setCashoutHistory(cashouts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()))
  }, [])

  // Update data dynamically every few seconds
  const updateDynamicData = useCallback(() => {
    // Update some random bets with new values
    setAllBets((prev) => {
      const updated = [...prev]
      for (let i = 0; i < 10; i++) {
        const randomIndex = Math.floor(Math.random() * updated.length)
        const amount = generateDynamicBetAmount()
        const multiplier = Math.random() * 100 + 1
        const status = Math.random() > 0.4 ? "win" : "loss"
        const winAmount = status === "win" ? amount * multiplier : 0

        updated[randomIndex] = {
          ...updated[randomIndex],
          player: generatePlayerName(),
          amount,
          multiplier: Number(multiplier.toFixed(2)),
          winAmount: Number(winAmount.toFixed(2)),
          status,
          timestamp: new Date(),
        }
      }
      return updated
    })

    // Update cashout history with recent multipliers
    setCashoutHistory((prev) => {
      const updated = [...prev]
      const recentMultiplier = previousMultipliers[Math.floor(Math.random() * Math.min(5, previousMultipliers.length))]
      const newCashout = {
        id: `cashout-${Date.now()}`,
        player: generatePlayerName(),
        avatar: ["🎮", "🚀", "⭐", "🔥", "💎", "🎯", "⚡", "🌟", "🎲", "🏆"][Math.floor(Math.random() * 10)],
        amount: generateDynamicBetAmount(),
        multiplier: recentMultiplier || Number((Math.random() * 50 + 1.1).toFixed(2)),
        winAmount: 0,
        timestamp: new Date(),
        timeAgo: generateTimeAgo(),
      }
      newCashout.winAmount = newCashout.amount * newCashout.multiplier

      return [newCashout, ...updated.slice(0, 999)]
    })
  }, [previousMultipliers])

  // Generate realistic crash point (Betika-like behavior)
  const generateCrashPoint = useCallback(() => {
    if (isAdmin) {
      const rand = Math.random()
      if (rand < 0.4) return 1.1 + Math.random() * 2.0
      if (rand < 0.7) return 2.0 + Math.random() * 8.0
      if (rand < 0.9) return 10.0 + Math.random() * 90.0
      return 100.0 + Math.random() * 900.0
    }

    // More unpredictable distribution
    const rand = Math.random()

    if (rand < 0.5) {
      return 1.0 + Math.random() * 1.5 // 50% chance: 1.00x - 2.50x
    } else if (rand < 0.75) {
      return 2.5 + Math.random() * 7.5 // 25% chance: 2.50x - 10.00x
    } else if (rand < 0.92) {
      return 10.0 + Math.random() * 90.0 // 17% chance: 10.00x - 100.00x
    } else {
      return 100.0 + Math.random() * 900.0 // 8% chance: 100.00x - 1000.00x
    }
  }, [isAdmin])

  useEffect(() => {
    generateDummyData()
    dataUpdateIntervalRef.current = setInterval(updateDynamicData, 3000)

    return () => {
      if (dataUpdateIntervalRef.current) {
        clearInterval(dataUpdateIntervalRef.current)
      }
    }
  }, [generateDummyData, updateDynamicData])

  const toggleMusic = async () => {
    if (!audioInitialized) {
      await initializeAudio()
    }

    setMusicEnabled(!musicEnabled)

    if (audioRef.current) {
      try {
        if (!musicEnabled) {
          if (gameState === "flying") {
            audioRef.current.currentTime = 0
            await audioRef.current.play()
          }
        } else {
          audioRef.current.pause()
        }
      } catch (error) {
        console.log("Audio toggle failed:", error)
      }
    }
  }

  const playTakeoffSound = async () => {
    if (audioRef.current && musicEnabled && audioInitialized) {
      try {
        audioRef.current.currentTime = 0
        audioRef.current.loop = true
        await audioRef.current.play()
        console.log("Takeoff sound playing")
      } catch (error) {
        console.log("Takeoff sound failed:", error)
      }
    }
  }

  const playCrashSound = async () => {
    if (audioRef.current) {
      audioRef.current.pause()
    }

    if (crashAudioRef.current && musicEnabled && audioInitialized) {
      try {
        crashAudioRef.current.currentTime = 0
        await crashAudioRef.current.play()
        console.log("Crash sound playing")
      } catch (error) {
        console.log("Crash sound failed:", error)
      }
    }
  }

  // 🎯 BETTING FUNCTIONALITY - Place a bet when button is clicked
  const placeBet = () => {
    // ✅ Check if game is in waiting state (can only bet before plane takes off)
    if (gameState !== "waiting") {
      console.log("❌ Cannot place bet - game already started")
      return
    }

    // ✅ Check if player has sufficient balance
    if (betAmount > balance) {
      console.log("❌ Insufficient balance for bet")
      return
    }

    // ✅ Check if bet is already active (prevent double betting)
    if (betActive) {
      console.log("❌ Bet already placed for this round")
      return
    }

    // ✅ Check if bet amount is at least $10
    if (betAmount < 10) {
      console.log("❌ Minimum bet amount is $10")
      return
    }

    // 🎲 PLACE THE BET - Deduct amount from balance and activate bet
    console.log(`🎯 Placing bet: $${betAmount.toFixed(2)}`)
    setBetActive(true)
    setBetCashed(false)
    setBalance((prev) => {
      const newBalance = prev - betAmount
      console.log(`💰 Balance updated: $${prev.toFixed(2)} → $${newBalance.toFixed(2)}`)
      return newBalance
    })

    console.log("✅ Bet placed successfully!")
  }

  // 🤖 AUTO-BET FUNCTIONALITY - Automatically place bets each round
  const handleAutoBet = () => {
    if (!autoBet) return

    console.log("🤖 Auto-bet triggered")

    // ✅ Check if we have enough balance for auto-bet
    if (betAmount <= balance) {
      console.log(`🎯 Auto-placing bet: $${betAmount.toFixed(2)}`)
      placeBet()
    } else {
      console.log("❌ Auto-bet cancelled - insufficient balance")
      setAutoBet(false) // Disable auto-bet if no funds
    }
  }

  // 💰 CASH OUT FUNCTIONALITY - Cash out current bet at current multiplier
  const cashOut = () => {
    // ✅ Check if game is flying (can only cash out during flight)
    if (gameState !== "flying") {
      console.log("❌ Cannot cash out - plane not flying")
      return
    }

    // ✅ Check if bet is active and not already cashed out
    if (!betActive || betCashed) {
      console.log("❌ No active bet to cash out")
      return
    }

    // 💰 CALCULATE WINNINGS
    const winAmount = betAmount * multiplier
    console.log(`💰 Cashing out: $${betAmount.toFixed(2)} × ${multiplier.toFixed(2)} = $${winAmount.toFixed(2)}`)

    if (isAdmin) {
      // 👑 ADMIN MODE - Allow successful cashout
      console.log("👑 Admin mode - cashout successful")
      setBetCashed(true)
      setBalance((prev) => {
        const newBalance = prev + winAmount
        console.log(`💰 Balance updated: $${prev.toFixed(2)} → $${newBalance.toFixed(2)}`)
        return newBalance
      })
    } else {
      // 🎲 REGULAR MODE - Crash on cashout attempt (realistic casino behavior)
      console.log("🎲 Regular mode - triggering crash on cashout attempt")
      setTimeout(
        () => {
          console.log("💥 Manual crash triggered!")
          manualCashoutRef.current = true
        },
        Math.random() * 50 + 10, // Random delay 10-60ms
      )
    }
  }

  // 🤖 AUTO CASH-OUT FUNCTIONALITY
  const handleAutoCashOut = (currentMultiplier: number) => {
    if (!autoCash || !betActive || betCashed) return

    // ✅ Check if current multiplier reached auto cash-out target
    if (currentMultiplier >= autoCashout) {
      console.log(`🤖 Auto cash-out triggered at ${currentMultiplier.toFixed(2)}x (target: ${autoCashout}x)`)

      if (isAdmin) {
        // 👑 Admin mode - successful auto cash-out
        const winAmount = betAmount * autoCashout
        console.log(`💰 Auto cash-out successful: $${winAmount.toFixed(2)}`)
        setBetCashed(true)
        setBalance((prev) => prev + winAmount)
      } else {
        // 🎲 Regular mode - crash on auto cash-out
        console.log("🎲 Auto cash-out triggered crash")
        manualCashoutRef.current = true
      }
    }
  }

  const startGame = useCallback(() => {
    if (gameState !== "waiting") return

    // 🎲 Generate crash point for this round
    crashPointRef.current = generateCrashPoint()
    console.log(`🎯 New round starting - crash point: ${crashPointRef.current.toFixed(2)}x`)

    manualCashoutRef.current = false
    setGameState("flying")
    setMultiplier(1.0)
    setBetCashed(false)
    setGraphData([]) // Reset graph when new round starts

    // 🎵 Play takeoff sound
    playTakeoffSound()

    let currentMultiplier = 1.0
    // 🚀 FAST/MEDIUM SPEED MOVEMENT - Not slow!
    const speedOptions = [1.2, 1.5, 1.8, 2.0, 2.2] // Fast to very fast speeds
    const baseSpeed = speedOptions[Math.floor(Math.random() * speedOptions.length)]
    console.log(`🚀 Plane speed for this round: ${baseSpeed}x`)

    gameIntervalRef.current = setInterval(() => {
      // 🎢 DYNAMIC SPEED FLUCTUATIONS - Fast up/down movement
      const speedFluctuation = 0.9 + Math.random() * 0.4 // 0.9 to 1.3
      const increment = (0.015 + currentMultiplier * 0.002) * baseSpeed * speedFluctuation
      currentMultiplier += increment
      // Update state together for perfect sync
      setMultiplier(currentMultiplier)
      setGraphData(prev => [
        ...prev,
        { x: currentMultiplier, y: currentMultiplier }
      ])
      // 🤖 Check auto cash-out
      handleAutoCashOut(currentMultiplier)
      // 💥 Check crash condition
      if (currentMultiplier >= crashPointRef.current || manualCashoutRef.current) {
        console.log(`💥 Game crashed at ${currentMultiplier.toFixed(2)}x`)
        setGameState("crashed")
        clearInterval(gameIntervalRef.current!)
        playCrashSound()
        // 📊 Update multiplier history
        setPreviousMultipliers((prev) => {
          const newMultipliers = [Number(currentMultiplier.toFixed(2)), ...prev.slice(0, 24)]
          return newMultipliers
        })
        // ⏰ Reset game after 3 seconds
        setTimeout(() => {
          console.log("🔄 Resetting game for next round")
          setGameState("waiting")
          setBetActive(false)
          setBetCashed(false)
          // 🤖 Trigger auto-bet for next round
          if (autoBet) {
            console.log("🤖 Auto-bet enabled - will place bet in next round")
            setTimeout(() => handleAutoBet(), 1000)
          }
        }, 3000)
      }
    }, 40) // Faster interval for smoother movement
  }, [gameState, generateCrashPoint, betActive, betCashed, betAmount, autoBet, autoCash, autoCashout, isAdmin])

  useEffect(() => {
    if (gameState === "waiting") {
      const timer = setTimeout(
        () => {
          startGame()
        },
        Math.random() * 3000 + 2000,
      )
      return () => clearTimeout(timer)
    }
  }, [gameState, startGame])

  // ✈️ PLANE MOVEMENT - Starts at 0,0 and moves fast up/down
  const getUnpredictablePlanePosition = () => {
    if (gameState !== "flying") {
      // 🏁 STARTING POSITION - Bottom left corner (0,0)
      return { left: "2%", bottom: "2%", transform: "rotate(15deg)" }
    }

    // 📈 FAST MOVEMENT CALCULATION - Base position grows with multiplier
    const baseLeft = Math.min(85, 2 + (multiplier - 1) * 12) // Faster horizontal movement
    const baseBottom = Math.min(80, 2 + (multiplier - 1) * 10) // Faster vertical movement

    // 🎢 FAST UP/DOWN VARIATIONS - Quick oscillations
    const fastOscillation = Math.sin(multiplier * 3) * 8 // Faster, bigger oscillations
    const quickVariation = Math.cos(multiplier * 2.5) * 5 + Math.random() * 3 - 1.5

    // 💨 DRAMATIC FAST MOVEMENTS - 15% chance for quick direction changes
    const dramaticMove = Math.random() < 0.15 ? (Math.random() - 0.5) * 15 : 0

    const finalLeft = Math.max(2, Math.min(85, baseLeft + fastOscillation + dramaticMove))
    const finalBottom = Math.max(2, Math.min(80, baseBottom + quickVariation))

    // 🔄 DYNAMIC ROTATION - Based on movement direction and speed
    const rotation = 15 + Math.sin(multiplier * 1.5) * 15 + (Math.random() - 0.5) * 8

    return {
      left: `${finalLeft}%`,
      bottom: `${finalBottom}%`,
      transform: `rotate(${rotation}deg)`,
    }
  }

  // 📍 DOTTED TRAIL PATH - Creates dotted line following plane movement
  const getDottedTrailPath = () => {
    if (gameState !== "flying") return ""

    const currentPos = getUnpredictablePlanePosition()
    const leftPercent = Number.parseFloat(currentPos.left)
    const bottomPercent = Number.parseFloat(currentPos.bottom)

    // 🛤️ CREATE CURVED DOTTED PATH from start (2,2) to current position
    const startX = 2
    const startY = 98 // SVG coordinates (bottom = 98 for 2% from bottom)
    const endX = leftPercent
    const endY = 100 - bottomPercent

    // 📈 CURVED PATH with control points for smooth trajectory
    const midX = (startX + endX) / 2 + Math.sin(multiplier) * 5
    const midY = (startY + endY) / 2 + Math.cos(multiplier) * 3

    return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`
  }

  const planePosition = getUnpredictablePlanePosition()

  // Calculate trajectory path for unpredictable movement
  const getTrajectoryPath = () => {
    if (gameState !== "flying") return ""

    const leftPercent = Number.parseFloat(planePosition.left)
    const bottomPercent = Number.parseFloat(planePosition.bottom)

    // Create a more dynamic path with curves
    const midX = leftPercent / 2
    const midY = 95 - bottomPercent / 2
    const controlX = midX + Math.sin(multiplier) * 10
    const controlY = midY + Math.cos(multiplier) * 5

    return `M 0 95 Q ${controlX} ${controlY} ${leftPercent} ${95 - bottomPercent}`
  }

  // Play WhatsApp audio on mount
  useEffect(() => {
    const playLoopAudio = async () => {
      try {
        if (welcomeAudioRef.current) {
          welcomeAudioRef.current.volume = 0.7
          welcomeAudioRef.current.muted = false
          await welcomeAudioRef.current.play()
          setShowSoundModal(false)
        }
      } catch (error) {
        setShowSoundModal(true)
      }
    }
    playLoopAudio()
  }, [])

  const handleEnableSound = async () => {
    if (welcomeAudioRef.current) {
      try {
        welcomeAudioRef.current.muted = false
        await welcomeAudioRef.current.play()
        setShowSoundModal(false)
      } catch {}
    }
  }

  // Play flew sound when crashed
  useEffect(() => {
    if (gameState === "crashed" && flewAudioRef.current) {
      flewAudioRef.current.currentTime = 0
      flewAudioRef.current.play()
    }
  }, [gameState])

  const getCurrentBets = () => {
    if (activeTab === "All Bets") return allBets
    if (activeTab === "Previous") return previousBets
    return topBets
  }

  const getMultiplierColor = (multiplier: number) => {
    if (multiplier <= 1.0) return "bg-red-500 text-white"
    if (multiplier <= 2.0) return "bg-orange-500 text-white"
    if (multiplier <= 5.0) return "bg-yellow-500 text-black"
    if (multiplier <= 10.0) return "bg-green-500 text-white"
    return "bg-blue-500 text-white"
  }

  const FlightGraph = ({ data, currentMultiplier }: { data: {x: number, y: number}[], currentMultiplier: number }) => {
    // Use the same positioning logic as the plane
    const getPlanePosition = (mult: number) => {
      const baseLeft = Math.min(85, 2 + (mult - 1) * 12);
      const baseBottom = Math.min(80, 2 + (mult - 1) * 10);
      const fastOscillation = Math.sin(mult * 3) * 8;
      const quickVariation = Math.cos(mult * 2.5) * 5;
      const dramaticMove = 0; // Don't use random for graph
      const finalLeft = Math.max(2, Math.min(85, baseLeft + fastOscillation + dramaticMove));
      const finalBottom = Math.max(2, Math.min(80, baseBottom + quickVariation));
      return { left: finalLeft, bottom: finalBottom };
    };
    // Convert percentage positions to SVG coordinates
    const points = data.map(point => {
      const pos = getPlanePosition(point.x);
      return {
        x: pos.left,
        y: 100 - pos.bottom // Flip Y-axis for SVG
      };
    });
    const currentPos = getPlanePosition(currentMultiplier);
    const currentPoint = {
      x: currentPos.left,
      y: 100 - currentPos.bottom
    };
    // Build path data
    const pathData = points.length > 0
      ? `M ${points[0].x} ${points[0].y} ` + 
        points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + 
        ` L ${currentPoint.x} ${currentPoint.y}`
      : '';
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 9 }}
      >
        <path
          d={pathData}
          stroke="#10B981"
          strokeWidth="0.5"
          fill="none"
          strokeLinecap="round"
        />
        {gameState === "flying" && (
          <circle
            cx={currentPoint.x}
            cy={currentPoint.y}
            r="1"
            fill="#10B981"
          />
        )}
      </svg>
    );
  };

  // On mount, use localStorage balance if present
  useEffect(() => {
    const storedBalance = localStorage.getItem("jetcash-balance")
    if (storedBalance && !isNaN(Number(storedBalance))) {
      setBalance(Number(storedBalance))
    }
  }, [])

  // Auto-logout after 10 minutes of inactivity
  useEffect(() => {
    let logoutTimer: NodeJS.Timeout | null = null
    const resetTimer = () => {
      if (logoutTimer) clearTimeout(logoutTimer)
      logoutTimer = setTimeout(() => {
        localStorage.clear()
        window.location.reload()
      }, 10 * 60 * 1000) // 10 minutes
    }
    // Listen for user activity
    window.addEventListener('mousemove', resetTimer)
    window.addEventListener('keydown', resetTimer)
    window.addEventListener('touchstart', resetTimer)
    window.addEventListener('scroll', resetTimer)
    resetTimer()
    return () => {
      if (logoutTimer) clearTimeout(logoutTimer)
      window.removeEventListener('mousemove', resetTimer)
      window.removeEventListener('keydown', resetTimer)
      window.removeEventListener('touchstart', resetTimer)
      window.removeEventListener('scroll', resetTimer)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <audio ref={audioRef} loop preload="auto" playsInline>
        <source src="/sounds/aviator-sound.mpga" type="audio/mpeg" />
      </audio>

      <audio ref={crashAudioRef} preload="auto" playsInline>
        <source src="/sounds/crash-sound.mp3" type="audio/mpeg" />
      </audio>

      <audio ref={welcomeAudioRef} preload="auto" playsInline loop>
        <source src="/audio.mp3" type="audio/mpeg" />
      </audio>

      <audio ref={flewAudioRef} preload="auto" playsInline>
        <source src="/flew.mp3" type="audio/mpeg" />
      </audio>

      {/* Mobile Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-xl font-bold text-red-400">JetCash Aviator</div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-green-400 font-bold text-sm flex items-center gap-2">
              ${balance.toFixed(2)}
              {greetingName && (
                <span className="text-xs text-green-300 ml-1">Hello {greetingName}</span>
              )}
            </div>
            {!profile && (
              <div className="flex items-center space-x-2">
                <Link href="/login">
                  <Button size="sm" variant="ghost" className="p-1">
                    <User className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden md:block bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <div className="text-2xl font-bold text-yellow-400">JetCash!</div>
            {isAdmin && <Badge className="bg-red-600 text-white">ADMIN MODE</Badge>}
            {greetingName && (
              <span className="ml-4 text-lg text-green-400">Hello {greetingName}</span>
            )}
            {profile && (
              <span className="ml-4 text-sm text-gray-300">{profile.phone ? `Phone: ${profile.phone}` : ""}</span>
            )}
          </div>

          <nav className="flex items-center space-x-6">
            <Link href="/" className="hover:text-yellow-400">
              Home
            </Link>
            <Link href="/" className="hover:text-yellow-400">
              Live (77)
            </Link>
            <Link href="/" className="hover:text-yellow-400">
              Jackpots
            </Link>
            <Link href="/" className="bg-green-600 px-3 py-1 rounded text-white font-semibold">
              Aviator
            </Link>
            <Link href="/" className="hover:text-yellow-400">
              Casino
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            <div className="text-green-400 font-bold">${balance.toFixed(2)}</div>
            {!profile && (
              <Link href="/login">
                <Button size="sm" variant="ghost">
                  <User className="w-5 h-5" />
                </Button>
              </Link>
            )}
            <Link href="/deposit">
              <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">Deposit</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] overflow-hidden">
        {/* Left Sidebar - Desktop Only */}
        <div className="hidden md:flex w-80 bg-gray-800 border-r border-gray-700 flex-col h-full">
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex space-x-2 mb-4">
              <Button
                variant={activeTab === "All Bets" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("All Bets")}
                className={
                  activeTab === "All Bets" ? "bg-gray-700 text-white" : "bg-transparent border-gray-600 text-gray-400"
                }
              >
                All Bets
              </Button>
              <Button
                variant={activeTab === "Previous" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("Previous")}
                className={
                  activeTab === "Previous" ? "bg-gray-700 text-white" : "bg-transparent border-gray-600 text-gray-400"
                }
              >
                Previous
              </Button>
              <Button
                variant={activeTab === "Top" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("Top")}
                className={
                  activeTab === "Top" ? "bg-gray-700 text-white" : "bg-transparent border-gray-600 text-gray-400"
                }
              >
                Top
              </Button>
            </div>

            <div className="text-sm text-gray-400 mb-2">ALL BETS</div>
            <div className="text-lg font-bold mb-4">{getCurrentBets().length.toLocaleString()}</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              <div className="grid grid-cols-4 text-xs text-gray-400 mb-2 sticky top-0 bg-gray-800 py-2 z-10">
                <span>Player</span>
                <span>Bet $</span>
                <span>X</span>
                <span>Win $</span>
              </div>

              {getCurrentBets()
                .slice(0, 100)
                .map((bet) => (
                  <div key={bet.id} className="grid grid-cols-4 text-sm py-1">
                    <div className="flex items-center space-x-1">
                      <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-xs">
                        {bet.player.charAt(0)}
                      </div>
                      <span className="truncate">{bet.player}</span>
                    </div>
                    <span className="text-xs">${bet.amount.toFixed(0)}</span>
                    <span className={bet.status === "win" ? "text-green-400" : "text-red-400"}>
                      {bet.status === "win" ? `${bet.multiplier.toFixed(2)}x` : "-"}
                    </span>
                    <span className={bet.status === "win" ? "text-green-400" : "text-red-400"}>
                      {bet.status === "win" ? `$${bet.winAmount.toFixed(0)}` : "$0"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Main Game Area */}
        <div className="flex-1 min-w-0 flex flex-col h-full">
          {/* Previous Multipliers */}
          <div className="bg-gray-800 p-2 md:p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center space-x-2 overflow-x-auto">
              {previousMultipliers.map((mult, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className={`${getMultiplierColor(mult)} whitespace-nowrap text-xs`}
                >
                  {mult.toFixed(2)}x
                </Badge>
              ))}
            </div>
          </div>

          {/* Game Canvas */}
          <div
            ref={gameCanvasRef}
            className="relative h-64 md:h-96 overflow-hidden flex-shrink-0"
            style={{
              background: `
                radial-gradient(ellipse at center, rgba(0,0,0,0.95) 0%, rgba(16,33,62,0.9) 20%, rgba(15,52,96,0.8) 40%, rgba(83,52,131,0.7) 60%, rgba(114,9,183,0.6) 80%, rgba(147,51,234,0.5) 100%),
                linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%),
                linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.02) 50%, transparent 60%)
              `,
              backgroundSize: "100% 100%, 100px 100px, 80px 80px",
              animation: gameState === "flying" ? "moveBackground 2s linear infinite" : "none", // Faster background
            }}
          >
            {/* 🛤️ DOTTED TRAIL LINE - Shows plane's path */}
            {gameState === "flying" && (
              <>
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 8 }}>
                  <defs>
                    <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>

                  {/* 📍 DOTTED TRAIL PATH */}
                  <path
                    d={getDottedTrailPath()}
                    stroke="url(#trailGradient)"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="8 4" // Dotted pattern
                    opacity="0.9"
                    style={{
                      animation: "dashMove 1s linear infinite", // Animated dots
                    }}
                  />
                </svg>
              </>
            )}

            {/* ✈️ PLANE WITH ATTACHED MULTIPLIER */}
            <div
              className="absolute transition-all duration-75 transform"
              style={{
                left: planePosition.left,
                bottom: planePosition.bottom,
                transform: planePosition.transform,
                filter: gameState === "flying" ? "drop-shadow(0 0 10px rgba(255,255,255,0.3))" : "none",
                zIndex: 20,
              }}
            >
              {/* 🛩️ LIGHTER PLANE ICON */}
              <div
                className="text-4xl md:text-6xl relative"
                style={{
                  filter:
                    gameState === "flying"
                      ? "brightness(1.3) drop-shadow(0 0 5px rgba(255,255,255,0.5))"
                      : "brightness(1.2)",
                  animation: gameState === "flying" ? "planeGlow 0.3s ease-in-out infinite alternate" : "none", // Faster glow
                }}
              >
                ✈️
                {/* 🪢 ROPE CONNECTION - Connects plane to multiplier */}
                {gameState === "flying" && (
                  <div
                    className="absolute top-full left-1/2 w-0.5 bg-yellow-400 opacity-70"
                    style={{
                      height: "40px",
                      transform: "translateX(-50%)",
                      boxShadow: "0 0 4px rgba(255, 255, 0, 0.5)",
                    }}
                  />
                )}
                {/* 🏷️ MULTIPLIER TAG - Attached to plane like a banner */}
                {gameState === "flying" && (
                  <div
                    className="absolute top-full left-1/2 transform -translate-x-1/2 mt-10"
                    style={{
                      animation: "multiplierSwing 2s ease-in-out infinite", // Swinging motion
                    }}
                  >
                    <div className="bg-yellow-400 text-black px-3 py-1 rounded-full font-bold text-lg shadow-lg border-2 border-yellow-300">
                      {multiplier.toFixed(2)}x
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 🎯 MAIN MULTIPLIER DISPLAY - Center of screen */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 5 }}>
              {gameState === "waiting" ? (
                <div className="text-center">
                  <div className="text-4xl md:text-6xl font-bold text-red-400 mb-4">UFC</div>
                  <div className="text-2xl md:text-4xl font-bold text-red-400 mb-2">Aviator</div>
                  <div className="text-lg md:text-xl text-white">OFFICIAL PARTNERS</div>
                  <div className="mt-4 bg-green-700 px-4 py-2 rounded text-white font-bold">
                    SPRIBE
                    <div className="text-xs">Official Game ✓</div>
                    <div className="text-xs">Since 2018</div>
                  </div>
                </div>
              ) : gameState === "flying" ? (
                <div
                  className="text-6xl md:text-8xl font-bold text-white drop-shadow-lg"
                  style={{
                    textShadow: "0 0 20px rgba(255,255,255,0.5)",
                    animation: "multiplierPulse 0.3s ease-in-out infinite alternate", // Faster pulse
                  }}
                >
                  {multiplier.toFixed(2)}x
                </div>
              ) : (
                <div className="text-4xl md:text-6xl font-bold text-red-400 drop-shadow-lg">FLEW AWAY!</div>
              )}
            </div>

            {/* Add this for the graph */}
            {gameState === "flying" && (
              <FlightGraph 
                data={graphData} 
                currentMultiplier={multiplier} 
              />
            )}
          </div>

          {/* Single Betting Panel */}
          <div className="bg-gray-800 p-4 md:p-6 flex-shrink-0 mb-0">
            <div className="max-w-md mx-auto">
              <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg">
                <div className="flex justify-center mb-4">
                  <div className="flex bg-gray-600 rounded-lg p-1">
                    <Button
                      variant={betMode === "bet" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setBetMode("bet")}
                      className={
                        betMode === "bet"
                          ? "px-8 bg-green-600 hover:bg-green-700 text-white"
                          : "px-8 bg-green-100 text-green-700 hover:bg-green-200"
                      }
                    >
                      Bet
                    </Button>
                    <Button
                      variant={betMode === "auto" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setBetMode("auto")}
                      className={
                        betMode === "auto"
                          ? "px-8 bg-green-600 hover:bg-green-700 text-white"
                          : "px-8 bg-green-100 text-green-700 hover:bg-green-200"
                      }
                    >
                      Auto
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-4 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(Math.max(10, betAmount - 1))}
                    className="bg-gray-600 border-gray-500 text-white w-10 h-10 rounded-full"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={betAmount.toFixed(2)}
                    onChange={(e) => setBetAmount(Math.max(10, Number.parseFloat(e.target.value) || 10))}
                    className="text-2xl font-bold text-white min-w-[120px] text-center bg-gray-600 border-gray-500"
                    step="0.01"
                    min="10"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(Math.max(10, betAmount + 1))}
                    className="bg-gray-600 border-gray-500 text-white w-10 h-10 rounded-full"
                  >
                    +
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[10, 25, 50, 100].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount(Math.max(10, amount))}
                      className="bg-gray-600 border-gray-500 text-white text-xs"
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>

                {betMode === "auto" && (
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Auto bet</span>
                      <Switch checked={autoBet} onCheckedChange={setAutoBet} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Auto Cash Out</span>
                      <Switch checked={autoCash} onCheckedChange={setAutoCash} />
                    </div>

                    {autoCash && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-400">At:</span>
                        <Input
                          type="number"
                          value={autoCashout}
                          onChange={(e) => setAutoCashout(Number.parseFloat(e.target.value) || 1.1)}
                          className="w-20 bg-gray-600 border-gray-500 text-white text-center text-xs"
                          step="0.01"
                          min="1.01"
                        />
                        <span className="text-sm text-gray-400">x</span>
                        <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => setAutoCash(false)}>
                          ×
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {gameState === "waiting" ? (
                  <Button
                    onClick={placeBet}
                    disabled={betActive || betAmount > balance || betAmount < 10}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 text-lg"
                  >
                    Bet
                    <br />${betAmount.toFixed(2)}
                  </Button>
                ) : betActive && !betCashed ? (
                  <Button
                    onClick={cashOut}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-6 text-lg"
                  >
                    Cash Out
                    <br />${(betAmount * multiplier).toFixed(2)}
                  </Button>
                ) : betCashed ? (
                  <Button disabled className="w-full bg-green-600 text-white py-6 text-lg">
                    Cashed Out
                    <br />${(betAmount * multiplier).toFixed(2)}
                  </Button>
                ) : (
                  <Button disabled className="w-full bg-gray-600 text-gray-400 py-6 text-lg">
                    Bet
                    <br />${betAmount.toFixed(2)}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Footer - only show on desktop, after main game area */}
          <footer className="hidden md:block bg-gray-800 border-t border-gray-700 p-4 text-center flex-shrink-0">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <span className="text-sm text-gray-400">✓ Provably Fair Game</span>
            </div>
            <div className="text-xs text-gray-500">Powered by SPRIBE</div>
          </footer>
        </div>

        {/* Right Sidebar - Desktop Only */}
        <div className="hidden md:flex w-80 bg-gray-800 border-l border-gray-700 flex-col h-full">
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Cashout History</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className={showTopCashouts ? "bg-yellow-500 text-black" : "bg-gray-700 text-white"}
                  onClick={() => setShowTopCashouts((prev) => !prev)}
                >
                  {showTopCashouts ? "Recent" : "Top Results"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowRules(!showRules)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Info className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              <div>{showTopCashouts ? "Biggest wins (highest win amounts)" : "Recent winners and their cashouts"}</div>
            </div>
          </div>

          {showRules ? (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Rules</h3>
                <Button size="sm" variant="ghost" onClick={() => setShowRules(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-4 text-sm text-gray-300">
                <div>
                  <h4 className="font-semibold text-white mb-2">How to Play</h4>
                  <p>1. Place your bet before the plane takes off</p>
                  <p>2. Watch the multiplier increase as the plane flies</p>
                  <p>3. Cash out before the plane flies away</p>
                  <p>4. The longer you wait, the higher the multiplier</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Auto Features</h4>
                  <p>• Auto Bet: Automatically place bets each round</p>
                  <p>• Auto Cash Out: Automatically cash out at set multiplier</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {(showTopCashouts
                  ? [...cashoutHistory].sort((a, b) => b.winAmount - a.winAmount).slice(0, 50)
                  : cashoutHistory.slice(0, 100)
                ).map((cashout) => (
                  <div key={cashout.id} className="flex items-start space-x-3 bg-gray-700 p-3 rounded-lg">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-lg">
                      {cashout.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-white">{cashout.player}</span>
                        <span className="text-xs text-gray-400">{cashout.timeAgo}</span>
                      </div>
                      <div className="text-xs text-gray-300">Bet: ${cashout.amount.toFixed(2)}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-green-400">{cashout.multiplier.toFixed(2)}x</span>
                        <span className="text-sm font-bold text-yellow-400">+${cashout.winAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Cashout History with Top Results button */}
      <div className="md:hidden bg-gray-900 p-3 flex-1 overflow-y-auto" style={{ height: 'calc(100vh - 64px - 200px)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-white">Cashout History</div>
          <Button
            size="sm"
            className={showTopCashouts ? "bg-yellow-500 text-black" : "bg-gray-700 text-white"}
            onClick={() => setShowTopCashouts((prev) => !prev)}
          >
            {showTopCashouts ? "Recent" : "Top Results"}
          </Button>
        </div>
        <div className="text-xs text-gray-400 mb-4">
          {showTopCashouts ? "Biggest wins (highest win amounts)" : "Recent winners and their cashouts"}
        </div>
        <div className="space-y-4">
          {(showTopCashouts
            ? [...cashoutHistory].sort((a, b) => b.winAmount - a.winAmount).slice(0, 50)
            : cashoutHistory.slice(0, 100)
          ).map((cashout) => (
            <div key={cashout.id} className="bg-gray-800 p-4 rounded-lg flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-lg">
                {cashout.avatar}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">{cashout.player}</span>
                  <span className="text-xs text-gray-400">{cashout.timestamp.toLocaleTimeString()}</span>
                </div>
                <div className="text-xs text-gray-300 mb-1">Bet: ${cashout.amount.toFixed(2)}</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-green-400">{cashout.multiplier.toFixed(2)}x</span>
                  <span className="text-sm font-bold text-yellow-400">
                    +${cashout.winAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Mobile Footer - only show on mobile, after cashout history */}
        <footer className="bg-gray-800 border-t border-gray-700 p-4 text-center mt-2 md:hidden">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <span className="text-sm text-gray-400">✓ Provably Fair Game</span>
          </div>
          <div className="text-xs text-gray-500">Powered by SPRIBE</div>
        </footer>
      </div>

      {/* Mobile Deposit Button */}
      <div className="md:hidden fixed bottom-4 right-4">
        <Link href="/deposit">
          <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-3 rounded-full shadow-lg">
            Deposit
          </Button>
        </Link>
      </div>

      {/* Sound Enable Modal */}
      {showSoundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-gray-900 rounded-lg shadow-lg p-4 w-80 max-w-full flex flex-col items-center">
            <div className="text-xl font-bold mb-2 text-white">Enable Sound?</div>
            <div className="mb-4 text-gray-300 text-center text-sm">Would you like to enable game sounds?</div>
            <div className="flex items-center space-x-2 mb-2 w-full justify-center">
              <Button
                onClick={async () => {
                  setMusicEnabled(true)
                  if (welcomeAudioRef.current) {
                    welcomeAudioRef.current.muted = false
                    await welcomeAudioRef.current.play()
                  }
                  setShowSoundModal(false)
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-base font-bold rounded flex-1"
              >
                Yes
              </Button>
              <Button
                onClick={() => {
                  setMusicEnabled(false)
                  if (welcomeAudioRef.current) {
                    welcomeAudioRef.current.muted = true
                  }
                  setShowSoundModal(false)
                }}
                className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 text-base font-bold rounded flex-1"
              >
                No
              </Button>
              <Button
                onClick={() => {
                  setMusicEnabled(true)
                  if (welcomeAudioRef.current) {
                    welcomeAudioRef.current.muted = false
                  }
                  setShowSoundModal(false)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-base font-bold rounded flex-1"
              >
                Default
              </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes moveBackground {
          0% {
            background-position: 0 0, 0 0, 0 0;
          }
          100% {
            background-position: 0 0, 100px 100px, -80px 80px;
          }
        }

        @keyframes planeGlow {
          0% {
            filter: brightness(1.3) drop-shadow(0 0 5px rgba(255,255,255,0.5));
          }
          100% {
            filter: brightness(1.5) drop-shadow(0 0 15px rgba(255,255,255,0.8));
          }
        }

        @keyframes multiplierPulse {
          0% {
            text-shadow: 0 0 20px rgba(255,255,255,0.5);
            transform: scale(1);
          }
          100% {
            text-shadow: 0 0 30px rgba(255,255,255,0.8);
            transform: scale(1.05);
          }
        }

        /* 🛤️ ANIMATED DOTTED TRAIL */
        @keyframes dashMove {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: 12;
          }
        }

        /* 🪢 SWINGING MULTIPLIER TAG */
        @keyframes multiplierSwing {
          0%, 100% {
            transform: translateX(-50%) rotate(-2deg);
          }
          50% {
            transform: translateX(-50%) rotate(2deg);
          }
        }

        @keyframes graphFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .flight-graph {
          animation: graphFadeIn 0.5s ease-out;
          z-index: 10;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  )
}