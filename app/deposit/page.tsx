"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Smartphone, CreditCard, Banknote, CheckCircle2, XCircle, Clock, RotateCw, Mail } from "lucide-react"
import Link from "next/link"

type PaymentStatus = 'idle' | 'pending' | 'success' | 'failed' | 'timeout' | 'wrong-pin'

type CardDetails = {
  number: string
  expiry: string
  cvv: string
  name: string
}

export default function DepositPage() {
  const [amount, setAmount] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [depositMethod, setDepositMethod] = useState("mpesa")
  const [kshAmount, setKshAmount] = useState(0)
  const [checkoutRequestID, setCheckoutRequestID] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle')
  const [pollingCount, setPollingCount] = useState(0)
  const [cardDetails, setCardDetails] = useState<CardDetails>({
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

  // Check auth status
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

  // Poll payment status if pending
  useEffect(() => {
    if (paymentStatus === 'pending' && checkoutRequestID) {
      const interval = setInterval(() => {
        checkPaymentStatus()
        setPollingCount(prev => prev + 1)
      }, 5000) // Check every 5 seconds

      // Stop polling after 10 attempts (50 seconds)
      if (pollingCount >= 10) {
        setPaymentStatus('timeout')
        clearInterval(interval)
      }

      return () => clearInterval(interval)
    }
  }, [paymentStatus, checkoutRequestID, pollingCount])

  const checkPaymentStatus = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://av-backend-qp7e.onrender.com/api/stk/stkquery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ checkoutRequestID })
      })

      const data = await response.json()
      
      if (!response.ok) throw new Error(data.message || "Failed to check payment status")

      if (data.data?.ResultCode === "0") {
        // Payment successful
        setPaymentStatus('success')
        saveSuccessfulDeposit()
      } else if (data.data?.ResultCode === "2001") {
        // Wrong PIN
        setPaymentStatus('wrong-pin')
      } else if (data.data?.ResultCode === "1037") {
        // Timeout
        setPaymentStatus('timeout')
      } else {
        // Other failure
        setPaymentStatus('failed')
      }
    } catch (error) {
      console.error("Error checking payment status:", error)
      setPaymentStatus('failed')
    }
  }

  const saveSuccessfulDeposit = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://av-backend-qp7e.onrender.com/api/deposits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name,
          email,
          phoneNumber,
          amount: parseFloat(amount),
          currency: "USD",
          status: "completed"
        })
      })

      if (!response.ok) {
        throw new Error("Failed to save deposit record")
      }
    } catch (error) {
      console.error("Error saving deposit:", error)
    }
  }

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

    // Validate name
    if (!name.trim()) {
      alert("Please enter your name")
      return
    }

    // Validate email
    if (!email.trim()) {
      alert("Please enter your email")
      return
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Please enter a valid email address")
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
    setPaymentStatus('pending')
    setPollingCount(0)
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

      // Save checkoutRequestID for polling
      setCheckoutRequestID(data.checkoutRequestID)
      alert("Payment request sent to your phone. Please complete the payment.")
    } catch (error: any) {
      setPaymentStatus('failed')
      alert(error.message || "An error occurred. Please try again.")
      console.error("Deposit error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetPayment = () => {
    setPaymentStatus('idle')
    setCheckoutRequestID("")
    setPollingCount(0)
  }

  const handleCardDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCardDetails(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const quickAmounts = [100, 250, 500, 1000, 2500]

  // Status display component
  const PaymentStatusDisplay = () => {
    switch (paymentStatus) {
      case 'success':
        return (
          <div className="bg-green-900/30 border border-green-800 rounded-lg p-6 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-bold text-green-500 mb-2">Payment Successful!</h3>
            <p className="text-green-300 mb-4">Your deposit of ${amount} has been received.</p>
            <p className="text-sm text-green-200 mb-4">A receipt has been sent to {email}</p>
            <Button onClick={() => router.push("/")} className="bg-green-600 hover:bg-green-700">
              Continue to Dashboard
            </Button>
          </div>
        )
      case 'failed':
        return (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-6 text-center">
            <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-xl font-bold text-red-500 mb-2">Payment Failed</h3>
            <p className="text-red-300 mb-4">We couldn't process your payment. Please try again.</p>
            <Button onClick={resetPayment} className="bg-red-600 hover:bg-red-700">
              Try Again
            </Button>
          </div>
        )
      case 'timeout':
        return (
          <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-6 text-center">
            <Clock className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold text-yellow-500 mb-2">Payment Timed Out</h3>
            <p className="text-yellow-300 mb-4">You took too long to complete the payment. Please try again.</p>
            <Button onClick={resetPayment} className="bg-yellow-600 hover:bg-yellow-700">
              Try Again
            </Button>
          </div>
        )
      case 'wrong-pin':
        return (
          <div className="bg-orange-900/30 border border-orange-800 rounded-lg p-6 text-center">
            <XCircle className="w-12 h-12 mx-auto text-orange-500 mb-4" />
            <h3 className="text-xl font-bold text-orange-500 mb-2">Incorrect PIN</h3>
            <p className="text-orange-300 mb-4">The M-Pesa PIN you entered was incorrect.</p>
            <Button onClick={resetPayment} className="bg-orange-600 hover:bg-orange-700">
              Try Again
            </Button>
          </div>
        )
      case 'pending':
        return (
          <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-6 text-center">
            <div className="animate-spin mb-4">
              <RotateCw className="w-12 h-12 mx-auto text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-blue-500 mb-2">Processing Payment</h3>
            <p className="text-blue-300 mb-4">
              Waiting for you to complete the payment on your phone...
              <br />
              <span className="text-sm">(Attempt {pollingCount} of 10)</span>
            </p>
            <Button onClick={resetPayment} variant="outline" className="border-blue-500 text-blue-500">
              Cancel Payment
            </Button>
          </div>
        )
      default:
        return null
    }
  }

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

        {/* Show payment status or form */}
        {paymentStatus !== 'idle' ? (
          <PaymentStatusDisplay />
        ) : (
          <>
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
                    Enter your details to deposit via M-Pesa
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleMpesaDeposit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deposit-name" className="text-white">Full Name</Label>
                      <Input
                        id="deposit-name"
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deposit-email" className="text-white">Email Address</Label>
                      <Input
                        id="deposit-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        required
                      />
                    </div>

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
                      <p className="text-xs text-gray-400">KES {kshAmount.toLocaleString()}</p>
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
                      disabled={isLoading || !amount || !phoneNumber || !name || !email}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
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
          </>
        )}
      </div>
    </div>
  )
}