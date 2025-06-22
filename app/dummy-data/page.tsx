"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, TrendingUp, Users, Target } from "lucide-react"
import Link from "next/link"

interface Player {
  id: string
  username: string
  totalBets: number
  totalWins: number
  biggestWin: number
  winRate: number
  avatar: string
}

interface GameRound {
  id: string
  multiplier: number
  timestamp: Date
  totalBets: number
  totalPayout: number
}

export default function DummyDataPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [gameRounds, setGameRounds] = useState<GameRound[]>([])
  const [activeTab, setActiveTab] = useState("players")

  useEffect(() => {
    // Generate 1000 dummy players
    const dummyPlayers: Player[] = []
    const avatars = ["🎮", "🚀", "⭐", "🔥", "💎", "🎯", "⚡", "🌟", "🎲", "🏆"]

    for (let i = 0; i < 1000; i++) {
      const totalBets = Math.floor(Math.random() * 10000) + 100
      const totalWins = Math.floor(totalBets * (Math.random() * 0.6 + 0.1))
      const biggestWin = Math.floor(Math.random() * 1000000) + 1000

      dummyPlayers.push({
        id: `player-${i}`,
        username: `Player${i.toString().padStart(4, "0")}`,
        totalBets,
        totalWins,
        biggestWin,
        winRate: Number(((totalWins / totalBets) * 100).toFixed(1)),
        avatar: avatars[Math.floor(Math.random() * avatars.length)],
      })
    }

    // Generate 5000 dummy game rounds
    const dummyRounds: GameRound[] = []
    for (let i = 0; i < 5000; i++) {
      const multiplier = Math.random() * 100 + 1
      const totalBets = Math.floor(Math.random() * 500) + 10
      const totalPayout = totalBets * multiplier * 0.8

      dummyRounds.push({
        id: `round-${i}`,
        multiplier: Number(multiplier.toFixed(2)),
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 30),
        totalBets,
        totalPayout: Number(totalPayout.toFixed(2)),
      })
    }

    setPlayers(dummyPlayers.sort((a, b) => b.biggestWin - a.biggestWin))
    setGameRounds(dummyRounds.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()))
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-yellow-400 hover:text-yellow-300 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Game
          </Link>
          <h1 className="text-3xl font-bold text-yellow-400">JetCash Database</h1>
          <p className="text-gray-400 mt-2">Comprehensive dummy data for testing and development</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-blue-400" />
              <div className="text-2xl font-bold text-white">{players.length.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Total Players</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <div className="text-2xl font-bold text-white">{gameRounds.length.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Game Rounds</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
              <div className="text-2xl font-bold text-white">
                {Math.max(...players.map((p) => p.biggestWin)).toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">Biggest Win (KES)</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-400" />
              <div className="text-2xl font-bold text-white">
                {Math.max(...gameRounds.map((r) => r.multiplier)).toFixed(2)}x
              </div>
              <div className="text-sm text-gray-400">Highest Multiplier</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6">
          <Button
            variant={activeTab === "players" ? "default" : "outline"}
            onClick={() => setActiveTab("players")}
            className="flex items-center space-x-2"
          >
            <Users className="w-4 h-4" />
            <span>Players</span>
          </Button>
          <Button
            variant={activeTab === "rounds" ? "default" : "outline"}
            onClick={() => setActiveTab("rounds")}
            className="flex items-center space-x-2"
          >
            <Target className="w-4 h-4" />
            <span>Game Rounds</span>
          </Button>
        </div>

        {/* Players Tab */}
        {activeTab === "players" && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Player Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-6 gap-4 text-sm text-gray-400 font-semibold border-b border-gray-600 pb-2">
                  <span>Rank</span>
                  <span>Player</span>
                  <span>Total Bets</span>
                  <span>Total Wins</span>
                  <span>Win Rate</span>
                  <span>Biggest Win</span>
                </div>
                {players.slice(0, 100).map((player, index) => (
                  <div key={player.id} className="grid grid-cols-6 gap-4 text-sm py-2 border-b border-gray-700">
                    <div className="flex items-center">
                      <Badge
                        variant="outline"
                        className={`${
                          index < 3
                            ? "bg-yellow-600 text-white border-yellow-500"
                            : "bg-gray-600 text-white border-gray-500"
                        }`}
                      >
                        #{index + 1}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{player.avatar}</span>
                      <span className="text-white font-medium">{player.username}</span>
                    </div>
                    <span className="text-gray-300">{player.totalBets.toLocaleString()}</span>
                    <span className="text-green-400">{player.totalWins.toLocaleString()}</span>
                    <span className="text-blue-400">{player.winRate}%</span>
                    <span className="text-yellow-400 font-bold">{player.biggestWin.toLocaleString()} KES</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Game Rounds Tab */}
        {activeTab === "rounds" && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Recent Game Rounds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-4 text-sm text-gray-400 font-semibold border-b border-gray-600 pb-2">
                  <span>Round ID</span>
                  <span>Multiplier</span>
                  <span>Total Bets</span>
                  <span>Total Payout</span>
                  <span>Timestamp</span>
                </div>
                {gameRounds.slice(0, 100).map((round) => (
                  <div key={round.id} className="grid grid-cols-5 gap-4 text-sm py-2 border-b border-gray-700">
                    <span className="text-gray-300 font-mono">{round.id}</span>
                    <span
                      className={`font-bold ${
                        round.multiplier >= 10
                          ? "text-purple-400"
                          : round.multiplier >= 2
                            ? "text-green-400"
                            : "text-red-400"
                      }`}
                    >
                      {round.multiplier.toFixed(2)}x
                    </span>
                    <span className="text-blue-400">{round.totalBets}</span>
                    <span className="text-yellow-400">{round.totalPayout.toLocaleString()} KES</span>
                    <span className="text-gray-400">{round.timestamp.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
