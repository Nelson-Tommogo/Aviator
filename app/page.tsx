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
}

// Currency conversion rate (1 USD = 150 KSH)
const USD_TO_KSH_RATE = 150

export default function JetWinAviator() {
  const [gameState, setGameState] = useState<"waiting" | "flying" | "crashed">("waiting")
  const [multiplier, setMultiplier] = useState(1.0)
  const [betAmount1, setBetAmount1] = useState(0.07) // $0.07 = 10 KSH
  const [betAmount2, setBetAmount2] = useState(0.07)
  const [autoCashout1, setAutoCashout1] = useState(1.1)
  const [autoCashout2, setAutoCashout2] = useState(1.1)
  const [balance, setBalance] = useState(0.004) // $0.004 = 0.6 KSH
  const [allBets, setAllBets] = useState<Bet[]>([])
  const [previousBets, setPreviousBets] = useState<Bet[]>([])
  const [topBets, setTopBets] = useState<Bet[]>([])
  const [cashoutHistory, setCashoutHistory] = useState<CashoutHistory[]>([])
  const [bet1Active, setBet1Active] = useState(false)
  const [bet2Active, setBet2Active] = useState(false)
  const [bet1Cashed, setBet1Cashed] = useState(false)
  const [bet2Cashed, setBet2Cashed] = useState(false)
  const [activeTab, setActiveTab] = useState("All Bets")
  const [autoBet1, setAutoBet1] = useState(false)
  const [autoBet2, setAutoBet2] = useState(false)
  const [autoCash1, setAutoCash1] = useState(false)
  const [autoCash2, setAutoCash2] = useState(false)
  const [betMode1, setBetMode1] = useState<"bet" | "auto">("bet")
  const [betMode2, setBetMode2] = useState<"bet" | "auto">("bet")
  const [showRules, setShowRules] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [previousMultipliers, setPreviousMultipliers] = useState<number[]>([])
  const [musicEnabled, setMusicEnabled] = useState(true)
  const [audioInitialized, setAudioInitialized] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const crashAudioRef = useRef<HTMLAudioElement>(null)
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const dataUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const crashPointRef = useRef<number>(1.0)
  const manualCashoutRef = useRef<boolean>(false)

  // Generate anonymous player name
  const generatePlayerName = () => {
    const firstDigit = Math.floor(Math.random() * 9) + 1
    const lastDigit = Math.floor(Math.random() * 10)
    return `${firstDigit}****${lastDigit}`
  }

  // Initialize audio with better web compatibility
  const initializeAudio = useCallback(async () => {
    if (!audioInitialized) {
      try {
        if (audioRef.current) {
          audioRef.current.volume = 0.3
          audioRef.current.muted = false
          audioRef.current.loop = true
          // Create a user gesture to unlock audio
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
        // Retry after user interaction
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
    const stored = localStorage.getItem("jetcash-multipliers")
    if (stored) {
      setPreviousMultipliers(JSON.parse(stored))
    } else {
      const initial = [2.01, 1.01, 1.28, 2.72, 1.27, 1.41, 2.74, 1.05, 1.52, 7.35, 1.84, 2.21, 2.83, 4.32, 1.23]
      setPreviousMultipliers(initial)
      localStorage.setItem("jetcash-multipliers", JSON.stringify(initial))
    }

    // Check if admin is logged in
    const email = localStorage.getItem("jetcash-user-email")
    if (email) {
      setUserEmail(email)
      setIsAdmin(email === "admin@gmail.com")
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

    // Auto-initialize after a delay
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

  // Currency conversion functions
  const usdToKsh = (usd: number) => usd * USD_TO_KSH_RATE
  const kshToUsd = (ksh: number) => ksh / USD_TO_KSH_RATE

  // Generate dynamic bet amount
  const generateDynamicBetAmount = () => {
    const amounts = [
      5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000,
    ]
    return amounts[Math.floor(Math.random() * amounts.length)]
  }

  // Generate massive dummy data with dynamic values
  const generateDummyData = useCallback(() => {
    const bets: Bet[] = []
    const cashouts: CashoutHistory[] = []

    for (let i = 0; i < 10000; i++) {
      const player = generatePlayerName()
      const amount = kshToUsd(generateDynamicBetAmount())
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

    // Generate cashout history (only wins)
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

    for (let i = 0; i < 1000; i++) {
      const player = generatePlayerName()
      const avatar = avatars[Math.floor(Math.random() * avatars.length)]
      const amount = kshToUsd(generateDynamicBetAmount())
      const multiplier = Math.random() * 50 + 1.1
      const winAmount = amount * multiplier

      cashouts.push({
        id: `cashout-${i}`,
        player,
        avatar,
        amount,
        multiplier: Number(multiplier.toFixed(2)),
        winAmount: Number(winAmount.toFixed(2)),
        timestamp: new Date(Date.now() - Math.random() * 86400000),
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
        const amount = kshToUsd(generateDynamicBetAmount())
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

    // Update cashout history
    setCashoutHistory((prev) => {
      const updated = [...prev]
      const newCashout = {
        id: `cashout-${Date.now()}`,
        player: generatePlayerName(),
        avatar: ["🎮", "🚀", "⭐", "🔥", "💎", "🎯", "⚡", "🌟", "🎲", "🏆"][Math.floor(Math.random() * 10)],
        amount: kshToUsd(generateDynamicBetAmount()),
        multiplier: Number((Math.random() * 50 + 1.1).toFixed(2)),
        winAmount: 0,
        timestamp: new Date(),
      }
      newCashout.winAmount = newCashout.amount * newCashout.multiplier

      return [newCashout, ...updated.slice(0, 999)]
    })
  }, [])

  // Generate realistic crash point (Betika-like behavior)
  const generateCrashPoint = useCallback(() => {
    if (isAdmin) {
      // Admin mode - fair gameplay
      const rand = Math.random()
      if (rand < 0.4) return 1.1 + Math.random() * 2.0 // 40% chance: 1.1x - 3.1x
      if (rand < 0.7) return 2.0 + Math.random() * 8.0 // 30% chance: 2.0x - 10.0x
      if (rand < 0.9) return 10.0 + Math.random() * 90.0 // 20% chance: 10.0x - 100.0x
      return 100.0 + Math.random() * 900.0 // 10% chance: 100.0x - 1000.0x
    }

    // Realistic Betika-like distribution
    const rand = Math.random()

    if (rand < 0.6) {
      // 60% chance: crash between 1.00x - 2.00x (most common)
      return 1.0 + Math.random() * 1.0
    } else if (rand < 0.85) {
      // 25% chance: crash between 2.00x - 10.00x
      return 2.0 + Math.random() * 8.0
    } else if (rand < 0.96) {
      // 11% chance: crash between 10.00x - 100.00x
      return 10.0 + Math.random() * 90.0
    } else {
      // 4% chance: crash between 100.00x - 1000.00x (rare moon shots)
      return 100.0 + Math.random() * 900.0
    }
  }, [isAdmin])

  useEffect(() => {
    generateDummyData()

    // Start dynamic data updates
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
          // Enabling music
          if (gameState === "flying") {
            audioRef.current.currentTime = 0
            await audioRef.current.play()
          }
        } else {
          // Disabling music
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
    // Stop takeoff sound first
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

  const startGame = useCallback(() => {
    if (gameState !== "waiting") return

    crashPointRef.current = generateCrashPoint()
    manualCashoutRef.current = false
    setGameState("flying")
    setMultiplier(1.0)
    setBet1Cashed(false)
    setBet2Cashed(false)

    playTakeoffSound()

    let currentMultiplier = 1.0
    // Variable speed based on crash point for more realistic feel
    const baseSpeed = crashPointRef.current > 10 ? 0.8 : crashPointRef.current > 2 ? 1.0 : 1.2

    gameIntervalRef.current = setInterval(() => {
      const increment = (0.01 + currentMultiplier * 0.001) * baseSpeed
      currentMultiplier += increment
      setMultiplier(currentMultiplier)

      // Admin mode - allow normal cashouts
      if (isAdmin) {
        if (autoCash1 && bet1Active && !bet1Cashed && currentMultiplier >= autoCashout1) {
          setBet1Cashed(true)
          const winAmount = betAmount1 * autoCashout1
          setBalance((prev) => prev + winAmount)
        }

        if (autoCash2 && bet2Active && !bet2Cashed && currentMultiplier >= autoCashout2) {
          setBet2Cashed(true)
          const winAmount = betAmount2 * autoCashout2
          setBalance((prev) => prev + winAmount)
        }
      }

      // Check crash condition
      if (currentMultiplier >= crashPointRef.current || manualCashoutRef.current) {
        setGameState("crashed")
        clearInterval(gameIntervalRef.current!)
        playCrashSound()

        setPreviousMultipliers((prev) => {
          const newMultipliers = [Number(currentMultiplier.toFixed(2)), ...prev.slice(0, 24)]
          return newMultipliers
        })

        setTimeout(() => {
          setGameState("waiting")
          setBet1Active(false)
          setBet2Active(false)
          setBet1Cashed(false)
          setBet2Cashed(false)

          if (autoBet1) {
            setTimeout(() => placeBet(1), 1000)
          }
          if (autoBet2) {
            setTimeout(() => placeBet(2), 1000)
          }
        }, 3000)
      }
    }, 50)
  }, [
    gameState,
    generateCrashPoint,
    autoCash1,
    autoCash2,
    autoCashout1,
    autoCashout2,
    bet1Active,
    bet2Active,
    bet1Cashed,
    bet2Cashed,
    betAmount1,
    betAmount2,
    autoBet1,
    autoBet2,
    isAdmin,
  ])

  useEffect(() => {
    if (gameState === "waiting") {
      const timer = setTimeout(
        () => {
          startGame()
        },
        Math.random() * 3000 + 2000,
      ) // Random wait time between 2-5 seconds
      return () => clearTimeout(timer)
    }
  }, [gameState, startGame])

  const placeBet = async (betNumber: 1 | 2) => {
    if (gameState !== "waiting") return

    const amount = betNumber === 1 ? betAmount1 : betAmount2
    if (amount > balance) return

    await initializeAudio()

    if (betNumber === 1) {
      setBet1Active(true)
    } else {
      setBet2Active(true)
    }

    setBalance((prev) => prev - amount)
  }

  const cashOut = (betNumber: 1 | 2) => {
    if (gameState !== "flying") return
    if ((betNumber === 1 && bet1Cashed) || (betNumber === 2 && bet2Cashed)) return

    if (isAdmin) {
      // Admin mode - allow successful cashout
      if (betNumber === 1 && bet1Active) {
        setBet1Cashed(true)
        const winAmount = betAmount1 * multiplier
        setBalance((prev) => prev + winAmount)
      }
      if (betNumber === 2 && bet2Active) {
        setBet2Cashed(true)
        const winAmount = betAmount2 * multiplier
        setBalance((prev) => prev + winAmount)
      }
    } else {
      // Regular mode - crash immediately on cashout attempt
      setTimeout(
        () => {
          manualCashoutRef.current = true
        },
        Math.random() * 50 + 10,
      ) // Random delay 10-60ms
    }
  }

  const getCurrentBets = () => {
    switch (activeTab) {
      case "Previous":
        return previousBets
      case "Top":
        return topBets
      default:
        return allBets
    }
  }

  const getMultiplierColor = (mult: number) => {
    if (mult >= 100) return "bg-purple-600 text-white border-purple-500"
    if (mult >= 10) return "bg-yellow-600 text-white border-yellow-500"
    if (mult >= 2) return "bg-green-600 text-white border-green-500"
    if (mult >= 1.5) return "bg-blue-600 text-white border-blue-500"
    return "bg-red-600 text-white border-red-500"
  }

  // Calculate trajectory path for the graph line
  const getTrajectoryPath = () => {
    if (gameState !== "flying") return ""

    const leftPercent = Number.parseFloat(planePosition.left)
    const bottomPercent = Number.parseFloat(planePosition.bottom)

    // Create a smooth graph line that follows the plane's path
    const startX = 5
    const startY = 95
    const endX = leftPercent
    const endY = 95 - bottomPercent
    
    // Create a smooth curve with multiple control points for a more natural graph
    const controlX1 = startX + (endX - startX) * 0.25
    const controlY1 = startY - 15
    const controlX2 = startX + (endX - startX) * 0.75
    const controlY2 = startY - bottomPercent * 0.6

    return `M ${startX} ${startY} Q ${controlX1} ${controlY1} ${controlX2} ${controlY2} T ${endX} ${endY}`
  }

  // Generate graph points for the trail effect
  const getGraphPoints = () => {
    if (gameState !== "flying") return []
    
    const points = []
    const steps = 50
    const progress = (multiplier - 1) / (crashPointRef.current - 1)
    
    for (let i = 0; i <= steps; i++) {
      const stepProgress = (i / steps) * progress
      const left = 5 + (stepProgress * 85)
      const bottom = 5 + (stepProgress * 80)
      points.push({ x: left, y: 95 - bottom })
    }
    
    return points
  }

  // Calculate plane position with more realistic movement
  const getPlanePosition = () => {
    if (gameState !== "flying") {
      return {
        left: "5%",
        bottom: "5%",
        transform: "rotate(-15deg)", // Slight upward tilt when waiting
      }
    }

    // More realistic movement calculation
    const progress = (multiplier - 1) / (crashPointRef.current - 1)
    const maxLeft = 85
    const maxBottom = 80
    
    // Start from bottom and move diagonally upward
    const left = 5 + (progress * maxLeft)
    const bottom = 5 + (progress * maxBottom)
    
    // Dynamic rotation - start with slight upward tilt and gradually increase
    const rotation = -5 - (progress * 20) // Start at -5deg, end at -25deg (natural takeoff angle)
    
    return {
      left: `${left}%`,
      bottom: `${bottom}%`,
      transform: `rotate(${rotation}deg)`,
    }
  }

  const planePosition = getPlanePosition()

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <audio ref={audioRef} loop preload="auto" playsInline>
        <source src="/sounds/aviator-sound.mpga" type="audio/mpeg" />
      </audio>

      <audio ref={crashAudioRef} preload="auto" playsInline>
        <source src="/sounds/crash-sound.mp3" type="audio/mpeg" />
      </audio>

      {/* Mobile Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Menu className="w-6 h-6" />
            <div className="text-xl font-bold text-red-400">Aviator</div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-green-400 font-bold text-sm">
              ${balance.toFixed(3)} ({usdToKsh(balance).toFixed(2)} KES)
            </div>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="ghost" onClick={toggleMusic} className="p-1">
                {musicEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Link href="/login">
                <Button size="sm" variant="ghost" className="p-1">
                  <User className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden md:block bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <Menu className="w-6 h-6" />
            <div className="text-2xl font-bold text-yellow-400">JetCash!</div>
            {isAdmin && <Badge className="bg-red-600 text-white">ADMIN MODE</Badge>}
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
            <div className="text-green-400 font-bold">
              ${balance.toFixed(3)} ({usdToKsh(balance).toFixed(2)} KES)
            </div>
            <Button size="sm" variant="ghost" onClick={toggleMusic}>
              {musicEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
            <Link href="/login">
              <Button size="sm" variant="ghost">
                <User className="w-5 h-5" />
              </Button>
            </Link>
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
                Top
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
                <span>Bet KES</span>
                <span>X</span>
                <span>Win KES</span>
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
                    <span className="text-xs">{usdToKsh(bet.amount).toFixed(0)}</span>
                    <span className={bet.status === "win" ? "text-green-400" : "text-red-400"}>
                      {bet.status === "win" ? `${bet.multiplier.toFixed(2)}x` : "-"}
                    </span>
                    <span className={bet.status === "win" ? "text-green-400" : "text-red-400"}>
                      {bet.status === "win" ? usdToKsh(bet.winAmount).toFixed(0) : "0"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Main Game Area - Fixed at bottom */}
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
            className="relative h-64 md:h-96 overflow-hidden flex-shrink-0"
            style={{
              background: `
                radial-gradient(ellipse at center, rgba(0,0,0,0.95) 0%, rgba(16,33,62,0.9) 20%, rgba(15,52,96,0.8) 40%, rgba(83,52,131,0.7) 60%, rgba(114,9,183,0.6) 80%, rgba(147,51,234,0.5) 100%),
                linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%),
                linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.02) 50%, transparent 60%)
              `,
              backgroundSize: "100% 100%, 100px 100px, 80px 80px",
              animation: gameState === "flying" ? "moveBackground 3s linear infinite" : "none",
            }}
          >
            {/* Graph Trail and Line */}
            {gameState === "flying" && (
              <>
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <defs>
                    <linearGradient id="graphGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#ef4444" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
                    </linearGradient>
                    <filter id="graphGlow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                      <feMerge> 
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Graph line with trail effect */}
                  <path 
                    d={getTrajectoryPath()} 
                    stroke="#ef4444" 
                    strokeWidth="3" 
                    fill="none" 
                    strokeLinecap="round"
                    filter="url(#graphGlow)"
                    opacity="0.9"
                  />

                  {/* Graph trail dots */}
                  {getGraphPoints().map((point, index) => (
                    <circle
                      key={index}
                      cx={`${point.x}%`}
                      cy={`${point.y}%`}
                      r="1.5"
                      fill="#ef4444"
                      opacity={0.6 - (index * 0.01)}
                    />
                  ))}

                  {/* Graph area fill */}
                  <path
                    d={`${getTrajectoryPath()} L ${planePosition.left} 100 L 5 100 Z`}
                    fill="url(#graphGradient)"
                    opacity="0.1"
                  />
                </svg>
              </>
            )}

            {/* Plane with enhanced styling */}
            <div
              className="absolute transition-all duration-75 transform"
              style={{
                left: planePosition.left,
                bottom: planePosition.bottom,
                transform: planePosition.transform,
                filter: gameState === "flying" ? "drop-shadow(0 0 10px rgba(255,255,255,0.3))" : "none",
              }}
            >
              <img
                src="/plane.svg"
                alt="Plane"
                className="w-16 h-16 md:w-24 md:h-24"
                style={{ 
                  filter: gameState === "flying" ? "brightness(1.3) drop-shadow(0 0 5px rgba(255,255,255,0.5))" : "brightness(1.2)",
                  animation: gameState === "flying" ? "planeGlow 1s ease-in-out infinite alternate" : "none",
                  transform: "scaleX(1.2) scaleY(1.1)",
                }}
              />
            </div>

            {/* Multiplier Display */}
            <div className="absolute inset-0 flex items-center justify-center">
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
                <div className="text-6xl md:text-8xl font-bold text-white drop-shadow-lg" style={{
                  textShadow: "0 0 20px rgba(255,255,255,0.5)",
                  animation: "multiplierPulse 0.5s ease-in-out infinite alternate"
                }}>
                  {multiplier.toFixed(2)}x
                </div>
              ) : (
                <div className="text-4xl md:text-6xl font-bold text-red-400 drop-shadow-lg">FLEW AWAY!</div>
              )}
            </div>
          </div>

          {/* Betting Panel - Fixed at bottom */}
          <div className="bg-gray-800 p-4 md:p-6 flex-shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Bet 1 */}
              <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg">
                <div className="flex justify-center mb-4">
                  <div className="flex bg-gray-600 rounded-lg p-1">
                    <Button
                      variant={betMode1 === "bet" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setBetMode1("bet")}
                      className="px-8"
                    >
                      Bet
                    </Button>
                    <Button
                      variant={betMode1 === "auto" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setBetMode1("auto")}
                      className="px-8"
                    >
                      Auto
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-4 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount1(Math.max(0.01, betAmount1 - 0.01))}
                    className="bg-gray-600 border-gray-500 text-white w-10 h-10 rounded-full"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={betAmount1.toFixed(2)}
                    onChange={(e) => setBetAmount1(Math.max(0.01, Number.parseFloat(e.target.value) || 0.01))}
                    className="text-2xl font-bold text-white min-w-[120px] text-center bg-gray-600 border-gray-500"
                    step="0.01"
                    min="0.01"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount1(betAmount1 + 0.01)}
                    className="bg-gray-600 border-gray-500 text-white w-10 h-10 rounded-full"
                  >
                    +
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[100, 200, 500, 20000].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount1(kshToUsd(amount))}
                      className="bg-gray-600 border-gray-500 text-white text-xs"
                    >
                      {amount >= 1000 ? `${amount / 1000}k` : amount}
                    </Button>
                  ))}
                </div>

                {betMode1 === "auto" && (
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Auto bet</span>
                      <Switch checked={autoBet1} onCheckedChange={setAutoBet1} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Auto Cash Out</span>
                      <Switch checked={autoCash1} onCheckedChange={setAutoCash1} />
                    </div>

                    {autoCash1 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-400">At:</span>
                        <Input
                          type="number"
                          value={autoCashout1}
                          onChange={(e) => setAutoCashout1(Number.parseFloat(e.target.value) || 1.1)}
                          className="w-20 bg-gray-600 border-gray-500 text-white text-center text-xs"
                          step="0.01"
                          min="1.01"
                        />
                        <span className="text-sm text-gray-400">x</span>
                        <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => setAutoCash1(false)}>
                          ×
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {gameState === "waiting" ? (
                  <Button
                    onClick={() => placeBet(1)}
                    disabled={bet1Active || betAmount1 > balance}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 text-lg"
                  >
                    Bet
                    <br />
                    {usdToKsh(betAmount1).toFixed(2)} KES
                  </Button>
                ) : bet1Active && !bet1Cashed ? (
                  <Button
                    onClick={() => cashOut(1)}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-6 text-lg"
                  >
                    Cash Out
                    <br />
                    {usdToKsh(betAmount1 * multiplier).toFixed(2)} KES
                  </Button>
                ) : bet1Cashed ? (
                  <Button disabled className="w-full bg-green-600 text-white py-6 text-lg">
                    Cashed Out
                    <br />
                    {usdToKsh(betAmount1 * multiplier).toFixed(2)} KES
                  </Button>
                ) : (
                  <Button disabled className="w-full bg-gray-600 text-gray-400 py-6 text-lg">
                    Bet
                    <br />
                    {usdToKsh(betAmount1).toFixed(2)} KES
                  </Button>
                )}
              </div>

              {/* Bet 2 */}
              <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg">
                <div className="flex justify-center mb-4">
                  <div className="flex bg-gray-600 rounded-lg p-1">
                    <Button
                      variant={betMode2 === "bet" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setBetMode2("bet")}
                      className="px-8"
                    >
                      Bet
                    </Button>
                    <Button
                      variant={betMode2 === "auto" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setBetMode2("auto")}
                      className="px-8"
                    >
                      Auto
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-4 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount2(Math.max(0.01, betAmount2 - 0.01))}
                    className="bg-gray-600 border-gray-500 text-white w-10 h-10 rounded-full"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={betAmount2.toFixed(2)}
                    onChange={(e) => setBetAmount2(Math.max(0.01, Number.parseFloat(e.target.value) || 0.01))}
                    className="text-2xl font-bold text-white min-w-[120px] text-center bg-gray-600 border-gray-500"
                    step="0.01"
                    min="0.01"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount2(betAmount2 + 0.01)}
                    className="bg-gray-600 border-gray-500 text-white w-10 h-10 rounded-full"
                  >
                    +
                  </Button>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[100, 200, 500, 20000].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount2(kshToUsd(amount))}
                      className="bg-gray-600 border-gray-500 text-white text-xs"
                    >
                      {amount >= 1000 ? `${amount / 1000}k` : amount}
                    </Button>
                  ))}
                </div>

                {betMode2 === "auto" && (
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Auto bet</span>
                      <Switch checked={autoBet2} onCheckedChange={setAutoBet2} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Auto Cash Out</span>
                      <Switch checked={autoCash2} onCheckedChange={setAutoCash2} />
                    </div>

                    {autoCash2 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-400">At:</span>
                        <Input
                          type="number"
                          value={autoCashout2}
                          onChange={(e) => setAutoCashout2(Number.parseFloat(e.target.value) || 1.1)}
                          className="w-20 bg-gray-600 border-gray-500 text-white text-center text-xs"
                          step="0.01"
                          min="1.01"
                        />
                        <span className="text-sm text-gray-400">x</span>
                        <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => setAutoCash2(false)}>
                          ×
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {gameState === "waiting" ? (
                  <Button
                    onClick={() => placeBet(2)}
                    disabled={bet2Active || betAmount2 > balance}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 text-lg"
                  >
                    Bet
                    <br />
                    {usdToKsh(betAmount2).toFixed(2)} KES
                  </Button>
                ) : bet2Active && !bet2Cashed ? (
                  <Button
                    onClick={() => cashOut(2)}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-6 text-lg"
                  >
                    Cash Out
                    <br />
                    {usdToKsh(betAmount2 * multiplier).toFixed(2)} KES
                  </Button>
                ) : bet2Cashed ? (
                  <Button disabled className="w-full bg-green-600 text-white py-6 text-lg">
                    Cashed Out
                    <br />
                    {usdToKsh(betAmount2 * multiplier).toFixed(2)} KES
                  </Button>
                ) : (
                  <Button disabled className="w-full bg-gray-600 text-gray-400 py-6 text-lg">
                    Bet
                    <br />
                    {usdToKsh(betAmount2).toFixed(2)} KES
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Footer - Fixed at bottom */}
          <footer className="bg-gray-800 border-t border-gray-700 p-4 text-center flex-shrink-0">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <span className="text-sm text-gray-400">✓ Provably Fair Game</span>
            </div>
            <div className="text-xs text-gray-500">Powered by SPRIBE</div>
          </footer>
        </div>

        {/* Right Sidebar - Desktop Only - Scrollable */}
        <div className="hidden md:flex w-80 bg-gray-800 border-l border-gray-700 flex-col h-full">
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Cashout History</span>
              <Button
                size="sm"
                onClick={() => setShowRules(!showRules)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Info className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs text-gray-400">
              <div>Recent winners and their cashouts</div>
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
                <div>
                  <h4 className="font-semibold text-white mb-2">Payment Methods</h4>
                  <p>• M-Pesa: Instant deposits and withdrawals</p>
                  <p>• Visa/Mastercard: Secure card payments</p>
                  <p>• Bank Transfer: Direct bank deposits</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {cashoutHistory.slice(0, 100).map((cashout) => (
                  <div key={cashout.id} className="flex items-start space-x-3 bg-gray-700 p-3 rounded-lg">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-lg">
                      {cashout.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-white">{cashout.player}</span>
                        <span className="text-xs text-gray-400">{cashout.timestamp.toLocaleTimeString()}</span>
                      </div>
                      <div className="text-xs text-gray-300">Bet: {usdToKsh(cashout.amount).toFixed(0)} KES</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-green-400">{cashout.multiplier.toFixed(2)}x</span>
                        <span className="text-sm font-bold text-yellow-400">
                          +{usdToKsh(cashout.winAmount).toFixed(0)} KES
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden flex bg-gray-800 border-t border-gray-700 flex-shrink-0">
        {["All Bets", "Previous", "Top"].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "ghost"}
            onClick={() => setActiveTab(tab)}
            className="flex-1 rounded-none"
          >
            {tab}
          </Button>
        ))}
      </div>

      {/* Mobile Bets List - Scrollable */}
      <div className="md:hidden bg-gray-900 p-4 overflow-y-auto flex-1" style={{ height: 'calc(100vh - 64px - 200px)' }}>
        <div className="text-sm text-gray-400 mb-2">{activeTab.toUpperCase()}</div>
        <div className="text-lg font-bold mb-4">{getCurrentBets().length.toLocaleString()}</div>

        <div className="space-y-4">
          {getCurrentBets()
            .slice(0, 50)
            .map((bet) => (
              <div key={bet.id} className="bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-sm">
                      {bet.player.charAt(0)}
                    </div>
                    <span className="font-semibold">{bet.player}</span>
                  </div>
                  <div className="text-xs text-gray-400">{bet.timestamp.toLocaleDateString()}</div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Bet KES</div>
                    <div className="text-white font-semibold">{usdToKsh(bet.amount).toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Result</div>
                    <div className={`font-semibold ${bet.status === "win" ? "text-green-400" : "text-red-400"}`}>
                      {bet.status === "win" ? `${bet.multiplier.toFixed(2)}x` : "Lost"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Win KES</div>
                    <div className={`font-semibold ${bet.status === "win" ? "text-green-400" : "text-red-400"}`}>
                      {bet.status === "win" ? usdToKsh(bet.winAmount).toFixed(0) : "0"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Round max.</div>
                    <div className="text-purple-400 font-semibold">{bet.multiplier.toFixed(2)}x</div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Mobile Deposit Button */}
      <div className="md:hidden fixed bottom-4 right-4">
        <Link href="/deposit">
          <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-3 rounded-full shadow-lg">
            Deposit
          </Button>
        </Link>
      </div>

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
      `}</style>
    </div>
  )
}
