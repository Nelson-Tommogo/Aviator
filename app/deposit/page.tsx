"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
  const [kshAmount, setKshAmount] = useState(0)
  const [cardDetails, setCardDetails] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: ""
  })
  const router = useRouter()

  // Convert USD to KSH in real-time (background calculation)
  useEffect(() => {
    const amountNum = parseFloat(amount) || 0
    setKshAmount(Math.round(amountNum * 130))
  }, [amount])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
    } else {
      fetch("https://av-backend-qp7e.onrender.com/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (!res.ok) {
          localStorage.removeItem("token")
          router.push("/login")
        }
      }).catch(() => {
        localStorage.removeItem("token")
        router.push("/login")
      })
    }
  }, [router])

  const handleMpesaDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate amount
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum)) {
      alert("Please enter a valid amount")
      return
    }
    if (amountNum < 100) {
      alert("Minimum deposit is $100")
      return
    }

    // Validate and format phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, '')
    let formattedPhone = cleanedPhone
    
    // Auto-correct common formats
    if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) {
      formattedPhone = '254' + cleanedPhone.substring(1)
    } else if (cleanedPhone.startsWith('7') && cleanedPhone.length === 9) {
      formattedPhone = '254' + cleanedPhone
    } else if (!cleanedPhone.startsWith('254') || cleanedPhone.length !== 12) {
      alert("Please enter a valid M-Pesa number (format: 254XXXXXXXXX)")
      return
    }

    setIsLoading(true)
    const token = localStorage.getItem("token")
    
    try {
      const response = await fetch("https://av-backend-qp7e.onrender.com/api/stk/stk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          phoneNumber: formattedPhone, 
          amount: kshAmount
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || "Deposit failed")
      }

      alert("Payment request sent to your phone. Please complete the payment.")
      setAmount("")
      setPhoneNumber("")
    } catch (error: any) {
      alert(error.message || "An error occurred. Please try again.")
      console.error("Deposit error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCardDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCardDetails(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const quickAmounts = [100, 250, 500, 1000, 2500]

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        {/* Back & Header */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-yellow-400 hover:text-yellow-300 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Game
          </Link>
          <h1 className="text-2xl font-bold text-yellow-400">Deposit Funds</h1>
          <p className="text-gray-400 mt-2">Add money to your account</p>
        </div>

        {/* Method Selector */}
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

        {/* M-Pesa Deposit Form */}
        {depositMethod === "mpesa" && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Smartphone className="w-5 h-5 mr-2 text-green-500" />
                M-Pesa Deposit
              </CardTitle>
              <CardDescription className="text-gray-400">
                Enter your M-Pesa number and amount
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMpesaDeposit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mpesa-phone" className="text-white">M-Pesa Number</Label>
                  <Input
                    id="mpesa-phone"
                    type="tel"
                    placeholder="2547XXXXXXXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                    required
                  />
                  <p className="text-xs text-gray-400">Format: 2547XXXXXXXX</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="mpesa-amount" className="text-white">Amount ($)</Label>
                  <Input
                    id="mpesa-amount"
                    type="number"
                    placeholder="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                    min="100"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(amt.toString())}
                      className="bg-gray-700 border-gray-600 text-white"
                    >
                      ${amt}
                    </Button>
                  ))}
                </div>
                
                <Button
                  type="submit"
                  disabled={isLoading || !amount || !phoneNumber}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing you request...
                    </span>
                  ) : (
                    `Deposit $${amount} USD`
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Card Deposit (Placeholder with full form) */}
        {depositMethod === "card" && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-blue-500" />
                Card Payment
              </CardTitle>
              <CardDescription className="text-gray-400">
                Pay with your credit or debit card
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="card-amount" className="text-white">Amount ($)</Label>
                  <Input
                    id="card-amount"
                    type="number"
                    placeholder="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                    min="100"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(amt.toString())}
                      className="bg-gray-700 border-gray-600 text-white"
                    >
                      ${amt}
                    </Button>
                  ))}
                </div>
                
                {/* Card Details Form */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="card-number" className="text-white">Card Number</Label>
                    <Input
                      id="card-number"
                      type="text"
                      placeholder="4242 4242 4242 4242"
                      name="number"
                      value={cardDetails.number}
                      onChange={handleCardDetailsChange}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="card-expiry" className="text-white">Expiry Date</Label>
                      <Input
                        id="card-expiry"
                        type="text"
                        placeholder="MM/YY"
                        name="expiry"
                        value={cardDetails.expiry}
                        onChange={handleCardDetailsChange}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="card-cvv" className="text-white">CVV</Label>
                      <Input
                        id="card-cvv"
                        type="text"
                        placeholder="123"
                        name="cvv"
                        value={cardDetails.cvv}
                        onChange={handleCardDetailsChange}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="card-name" className="text-white">Cardholder Name</Label>
                    <Input
                      id="card-name"
                      type="text"
                      placeholder="John Doe"
                      name="name"
                      value={cardDetails.name}
                      onChange={handleCardDetailsChange}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
                
                <div className="border border-dashed border-gray-600 rounded-lg p-6 text-center">
                  <CreditCard className="w-10 h-10 mx-auto text-blue-400 mb-3" />
                  <h3 className="font-medium text-white">Card Payments Coming Soon</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    We're working to integrate secure card payments
                  </p>
                </div>
                
                <Button
                  disabled={true}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3"
                >
                  Pay ${amount || '0'} USD
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bank Transfer (Placeholder) */}
        {depositMethod === "bank" && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Banknote className="w-5 h-5 mr-2 text-purple-500" />
                Bank Transfer
              </CardTitle>
              <CardDescription className="text-gray-400">
                Transfer directly from your bank account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bank-amount" className="text-white">Amount ($)</Label>
                  <Input
                    id="bank-amount"
                    type="number"
                    placeholder="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                    min="100"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {quickAmounts.map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(amt.toString())}
                      className="bg-gray-700 border-gray-600 text-white"
                    >
                      ${amt}
                    </Button>
                  ))}
                </div>
                
                <div className="border border-dashed border-gray-600 rounded-lg p-6 text-center">
                  <Banknote className="w-10 h-10 mx-auto text-purple-400 mb-3" />
                  <h3 className="font-medium text-white">Bank Transfers Coming Soon</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    We'll soon support direct bank transfers
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction Information */}
        <Card className="bg-gray-800 border-gray-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white text-lg">Deposit Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Minimum deposit:</span>
                <span className="text-white">$100</span>
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