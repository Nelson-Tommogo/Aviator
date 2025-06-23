"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Smartphone, CreditCard, Banknote } from "lucide-react"
import Link from "next/link"

export default function DepositPage() {
  const [amount, setAmount] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [depositMethod, setDepositMethod] = useState("mpesa")

  const handleMpesaDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum < 10) {
      alert("Minimum deposit is $10")
      return
    }
    setIsLoading(true)
    // USD to Ksh conversion (fixed rate, update if needed)
    const kshAmount = Math.round(amountNum * 140)
    try {
      const res = await fetch("https://av-backend-qp7e.onrender.com/stk/stk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber,
          amount: kshAmount
        })
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.message || "Deposit failed")
        setIsLoading(false)
        return
      }
      setIsLoading(false)
      alert("M-Pesa STK Push sent to your phone. Please complete the transaction.")
    } catch (err) {
      alert("Network error. Please try again.")
      setIsLoading(false)
    }
  }

  const quickAmounts = [10, 25, 50, 100, 250, 500]

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-yellow-400 hover:text-yellow-300 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Game
          </Link>
          <h1 className="text-2xl font-bold text-yellow-400">Deposit Funds</h1>
          <p className="text-gray-400 mt-2">Add money to your JetCash account</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <Button
            variant={depositMethod === "mpesa" ? "default" : "outline"}
            onClick={() => setDepositMethod("mpesa")}
            className="flex flex-col items-center p-4 h-auto"
          >
            <Smartphone className="w-6 h-6 mb-2" />
            <span className="text-xs">M-Pesa</span>
          </Button>
          <Button
            variant={depositMethod === "card" ? "default" : "outline"}
            onClick={() => setDepositMethod("card")}
            className="flex flex-col items-center p-4 h-auto"
          >
            <CreditCard className="w-6 h-6 mb-2" />
            <span className="text-xs">Card</span>
          </Button>
          <Button
            variant={depositMethod === "bank" ? "default" : "outline"}
            onClick={() => setDepositMethod("bank")}
            className="flex flex-col items-center p-4 h-auto"
          >
            <Banknote className="w-6 h-6 mb-2" />
            <span className="text-xs">Bank</span>
          </Button>
        </div>

        {depositMethod === "mpesa" && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Smartphone className="w-5 h-5 mr-2 text-green-500" />
                M-Pesa Deposit
              </CardTitle>
              <CardDescription className="text-gray-400">
                Enter your M-Pesa number and amount to deposit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMpesaDeposit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white">
                    M-Pesa Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="254700000000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-white">
                    Amount ($)
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                    min="1"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Quick Amounts</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {quickAmounts.map((quickAmount) => (
                      <Button
                        key={quickAmount}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAmount(quickAmount.toString())}
                        className="bg-gray-700 border-gray-600 text-white"
                      >
                        ${quickAmount}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                  <div className="text-sm text-green-400">
                    <strong>How it works:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Enter your M-Pesa number and amount</li>
                      <li>Click "Send STK Push"</li>
                      <li>Check your phone for M-Pesa prompt</li>
                      <li>Enter your M-Pesa PIN to complete</li>
                    </ol>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !amount || !phoneNumber}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
                >
                  {isLoading ? "Sending STK Push..." : `Deposit $${amount}`}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {depositMethod === "card" && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-blue-500" />
                Card Deposit
              </CardTitle>
              <CardDescription className="text-gray-400">Pay with your debit or credit card</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardNumber" className="text-white">
                    Card Number
                  </Label>
                  <Input
                    id="cardNumber"
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    className="bg-gray-700 border-gray-600 text-white"
                    maxLength={19}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate" className="text-white">
                      Expiry Date
                    </Label>
                    <Input
                      id="expiryDate"
                      type="text"
                      placeholder="MM/YY"
                      className="bg-gray-700 border-gray-600 text-white"
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvv" className="text-white">
                      CVV
                    </Label>
                    <Input
                      id="cvv"
                      type="text"
                      placeholder="123"
                      className="bg-gray-700 border-gray-600 text-white"
                      maxLength={4}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardName" className="text-white">
                    Cardholder Name
                  </Label>
                  <Input
                    id="cardName"
                    type="text"
                    placeholder="John Doe"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardAmount" className="text-white">
                    Amount ($)
                  </Label>
                  <Input
                    id="cardAmount"
                    type="number"
                    placeholder="Enter amount"
                    className="bg-gray-700 border-gray-600 text-white"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Quick Amounts</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {quickAmounts.map((quickAmount) => (
                      <Button
                        key={quickAmount}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="bg-gray-700 border-gray-600 text-white"
                      >
                        ${quickAmount}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3">
                  Pay with Card
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {depositMethod === "bank" && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Banknote className="w-5 h-5 mr-2 text-purple-500" />
                Bank Transfer
              </CardTitle>
              <CardDescription className="text-gray-400">Transfer money directly from your bank</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Banknote className="w-16 h-16 mx-auto text-gray-500 mb-4" />
                <p className="text-gray-400">Bank transfers coming soon!</p>
                <p className="text-sm text-gray-500 mt-2">Use M-Pesa for now</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gray-800 border-gray-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white text-sm">Transaction Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Minimum deposit:</span>
                <span className="text-white">$1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Maximum deposit:</span>
                <span className="text-white">$10,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Processing time:</span>
                <span className="text-white">Instant</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
