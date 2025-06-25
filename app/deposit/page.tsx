"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Smartphone, CreditCard, Banknote, CheckCircle2, XCircle, Clock, RotateCw } from "lucide-react"
import Link from "next/link"

type PaymentStatus =
  | "idle"
  | "pending"
  | "success"
  | "failed"
  | "timeout"
  | "wrong-pin"
  | "cancelled"
  | "insufficient-funds"

type CardDetails = {
  number: string
  expiry: string
  cvv: string
  name: string
}

export default function DepositPageEarlySave() {
  const [amount, setAmount] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [depositMethod, setDepositMethod] = useState("mpesa")
  const [kshAmount, setKshAmount] = useState(0)
  const [checkoutRequestID, setCheckoutRequestID] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle")
  const [pollingCount, setPollingCount] = useState(0)
  const [depositId, setDepositId] = useState<string>("")
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
  })
  const router = useRouter()

  // Convert USD to KSH in real-time (background calculation)
  useEffect(() => {
    const amountNum = Number.parseFloat(amount) || 0
    setKshAmount(Math.round(amountNum * 130))
  }, [amount])

  // Check auth status
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
    } else {
      fetch("https://av-backend-qp7e.onrender.com/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) {
            localStorage.removeItem("token")
            router.push("/login")
          }
        })
        .catch(() => {
          localStorage.removeItem("token")
          router.push("/login")
        })
    }
  }, [router])

  // Poll payment status if pending
  useEffect(() => {
    if (paymentStatus === "pending" && checkoutRequestID) {
      const interval = setInterval(() => {
        checkPaymentStatus()
        setPollingCount((prev) => prev + 1)
      }, 5000) // Check every 5 seconds

      // Stop polling after 12 attempts (60 seconds)
      if (pollingCount >= 12) {
        clearInterval(interval)
        // Don't show timeout to user, just redirect
        router.push("/")
      }

      return () => clearInterval(interval)
    }
  }, [paymentStatus, checkoutRequestID, pollingCount, router])

  const checkPaymentStatus = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://av-backend-qp7e.onrender.com/api/stk/stkquery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ checkoutRequestID }),
      })

      const data = await response.json()
      console.log("STK Query Response:", data)

      if (!response.ok) {
        console.error("STK Query API Error:", data)
        if (pollingCount >= 10) {
          throw new Error(data.message || "Failed to check payment status")
        }
        return
      }

      if (!data.data) {
        console.log("No data in response, continuing to poll...")
        return
      }

      const resultCode = data.data.ResultCode?.toString()
      console.log("Result Code:", resultCode)

      // Handle different Safaricom response codes
      if (resultCode === "0") {
        // Payment successful
        console.log("Payment successful!")
        setPaymentStatus("success")
        await updateDepositStatus("completed", data.data)
      } else if (resultCode === "1") {
        setPaymentStatus("insufficient-funds")
        await updateDepositStatus("failed", data.data, "Insufficient funds")
      } else if (resultCode === "2001") {
        setPaymentStatus("wrong-pin")
        await updateDepositStatus("failed", data.data, "Wrong PIN entered")
      } else if (resultCode === "1032" || resultCode === "1031" || resultCode === "17") {
        setPaymentStatus("cancelled")
        await updateDepositStatus("cancelled", data.data, "Payment cancelled by user")
      } else if (resultCode === "1037" || resultCode === "26") {
        setPaymentStatus("timeout")
        await updateDepositStatus("timeout", data.data, "Payment timeout")
      } else if (resultCode && resultCode !== "0") {
        console.log("Payment failed with code:", resultCode)
        setPaymentStatus("failed")
        await updateDepositStatus("failed", data.data, `Payment failed with code: ${resultCode}`)
      }
    } catch (error) {
      console.error("Error checking payment status:", error)
      if (pollingCount >= 10) {
        setPaymentStatus("failed")
        await updateDepositStatus("failed", null, "Error checking payment status")
      }
    }
  }

  // Save transaction immediately after STK push success
  const saveInitialDeposit = async (checkoutRequestId: string) => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://av-backend-qp7e.onrender.com/api/deposits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          email,
          phone: phoneNumber.replace(/\D/g, ""),
          amount: Number.parseFloat(amount),
          currency: "USD",
          status: "pending", 
          method: "mpesa",
          checkoutRequestId: checkoutRequestId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("Failed to save initial deposit:", result)
        throw new Error("Failed to save deposit record")
      }

      console.log("Initial deposit saved successfully:", result)
      setDepositId(result.id || result._id)
      return result
    } catch (error) {
      console.error("Error saving initial deposit:", error)
      throw error
    }
  }

  // Update deposit status
  const updateDepositStatus = async (status: string, transactionData?: any, failureReason?: string) => {
    if (!depositId) {
      console.log("No deposit ID to update")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`https://av-backend-qp7e.onrender.com/api/deposits/${depositId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: status,
          transactionId: transactionData?.MpesaReceiptNumber || checkoutRequestID,
          mpesaData: transactionData,
          failureReason: failureReason,
          completedAt: status === "completed" ? new Date().toISOString() : null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error("Failed to update deposit status:", result)
      } else {
        console.log("Deposit status updated successfully:", result)
      }
    } catch (error) {
      console.error("Error updating deposit status:", error)
    }
  }

  const handleMpesaDeposit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate amount
    const amountNum = Number.parseFloat(amount)
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
    const cleanedPhone = phoneNumber.replace(/\D/g, "")
    let formattedPhone = cleanedPhone

    if (cleanedPhone.startsWith("0") && cleanedPhone.length === 10) {
      formattedPhone = "254" + cleanedPhone.substring(1)
    } else if (cleanedPhone.startsWith("7") && cleanedPhone.length === 9) {
      formattedPhone = "254" + cleanedPhone
    } else if (!cleanedPhone.startsWith("254") || cleanedPhone.length !== 12) {
      alert("Please enter a valid M-Pesa number (format: 254XXXXXXXXX)")
      return
    }

    setIsLoading(true)
    setPollingCount(0)
    const token = localStorage.getItem("token")

    try {
      const response = await fetch("https://av-backend-qp7e.onrender.com/api/stk/stk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          amount: kshAmount,
        }),
      })

      const data = await response.json()
      console.log("STK Push Response:", data)

      if (!response.ok) {
        throw new Error(data.message || "Deposit failed")
      }

      if (data.checkoutRequestID) {
        setCheckoutRequestID(data.checkoutRequestID)

        // Save transaction immediately after STK push success
        try {
          await saveInitialDeposit(data.checkoutRequestID)
          setPaymentStatus("pending")
          alert("Payment request sent to your phone. Please complete the payment on your device.")
          // Redirect after 5 seconds if still pending
          setTimeout(() => {
            if (paymentStatus === "pending") {
              router.push("/")
            }
          }, 5000)
        } catch (saveError) {
          console.error("Failed to save initial deposit:", saveError)
          alert("Payment request sent but failed to save to database. Please contact support if payment is successful.")
          setPaymentStatus("pending")
        }
      } else {
        throw new Error("No checkout request ID received")
      }
    } catch (error: any) {
      setPaymentStatus("failed")
      alert(error.message || "An error occurred. Please try again.")
      console.error("Deposit error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetPayment = () => {
    setPaymentStatus("idle")
    setCheckoutRequestID("")
    setPollingCount(0)
    setDepositId("")
  }

  const handleCardDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCardDetails((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const quickAmounts = [100, 250, 500, 1000, 2500]

  // Status display component
  const PaymentStatusDisplay = () => {
    switch (paymentStatus) {
      case "success":
        return (
          <div className="bg-green-900/30 border border-green-800 rounded-lg p-6 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-bold text-green-500 mb-2">Payment Successful!</h3>
            <p className="text-green-300 mb-4">
              Your deposit of ${amount} has been completed and your account has been credited.
            </p>
            <Button onClick={() => router.push("/")} className="bg-green-600 hover:bg-green-700">
              Continue to Dashboard
            </Button>
          </div>
        )
      case "failed":
      case "timeout":
      case "wrong-pin":
      case "cancelled":
      case "insufficient-funds":
        return (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-6 text-center">
            <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-xl font-bold text-red-500 mb-2">Payment Not Completed</h3>
            <p className="text-red-300 mb-4">
              We couldn't verify your payment. Please try again or contact support.
            </p>
            <Button onClick={resetPayment} className="bg-red-600 hover:bg-red-700">
              Try Again
            </Button>
          </div>
        )
      case "pending":
        return (
          <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-6 text-center">
            <div className="animate-spin mb-4">
              <RotateCw className="w-12 h-12 mx-auto text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-blue-500 mb-2">Payment Pending Verification</h3>
            <p className="text-blue-300 mb-4">
              Your transaction has been received and is being verified. You'll be redirected shortly.
            </p>
            <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700">
              Go to Dashboard Now
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
          <p className="text-gray-400 mt-2">Transactions are saved immediately after initiating payment</p>
        </div>

        {/* Show payment status or form */}
        {paymentStatus !== "idle" ? (
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
                    Transactions are saved immediately after initiating payment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleMpesaDeposit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deposit-name" className="text-white">
                        Full Name
                      </Label>
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
                      <Label htmlFor="deposit-email" className="text-white">
                        Email Address
                      </Label>
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
                      <Label htmlFor="mpesa-phone" className="text-white">
                        M-Pesa Number
                      </Label>
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
                      <Label htmlFor="mpesa-amount" className="text-white">
                        Amount ($)
                      </Label>
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
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
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

          {/* Card Payment Form */}
{depositMethod === "card" && (
  <Card className="bg-gray-800 border-gray-700">
    <CardHeader>
      <CardTitle className="text-white flex items-center">
        <CreditCard className="w-5 h-5 mr-2 text-blue-500" />
        Card Payment
      </CardTitle>
      <CardDescription className="text-gray-400">Pay with your credit or debit card</CardDescription>
    </CardHeader>
    <CardContent>
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="card-name" className="text-white">
            Name on Card
          </Label>
          <Input
            id="card-name"
            type="text"
            placeholder="John Doe"
            name="name"
            value={cardDetails.name}
            onChange={handleCardDetailsChange}
            className="bg-gray-700 border-gray-600 text-white"
            disabled
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-number" className="text-white">
            Card Number
          </Label>
          <Input
            id="card-number"
            type="text"
            placeholder="4242 4242 4242 4242"
            name="number"
            value={cardDetails.number}
            onChange={handleCardDetailsChange}
            className="bg-gray-700 border-gray-600 text-white"
            disabled
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="card-expiry" className="text-white">
              Expiry Date
            </Label>
            <Input
              id="card-expiry"
              type="text"
              placeholder="MM/YY"
              name="expiry"
              value={cardDetails.expiry}
              onChange={handleCardDetailsChange}
              className="bg-gray-700 border-gray-600 text-white"
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="card-cvv" className="text-white">
              CVV
            </Label>
            <Input
              id="card-cvv"
              type="text"
              placeholder="123"
              name="cvv"
              value={cardDetails.cvv}
              onChange={handleCardDetailsChange}
              className="bg-gray-700 border-gray-600 text-white"
              disabled
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-amount" className="text-white">
            Amount ($)
          </Label>
          <Input
            id="card-amount"
            type="number"
            placeholder="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white"
            min="100"
            disabled
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
              disabled
            >
              ${amt}
            </Button>
          ))}
        </div>

        <div className="border border-dashed border-blue-500 rounded-lg p-6 text-center bg-blue-900/10">
          <CreditCard className="w-10 h-10 mx-auto text-blue-400 mb-3" />
          <h3 className="font-medium text-white">Card Payment not Accepted in your country use  Phone Transfer option</h3>
          <p className="text-sm text-gray-400 mt-1">
            We'll notify you  soon
          </p>
        </div>

        <Button
          type="button"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3"
          disabled
        >
          Pay with Card
        </Button>
      </form>
    </CardContent>
  </Card>
)}

{/* Bank Transfer Form */}
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
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bank-name" className="text-white">
            Full Name
          </Label>
          <Input
            id="bank-name"
            type="text"
            placeholder="As shown on bank account"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white"
            disabled
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank-account" className="text-white">
            Bank Account Number
          </Label>
          <Input
            id="bank-account"
            type="text"
            placeholder="1234567890"
            className="bg-gray-700 border-gray-600 text-white"
            disabled
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank-name" className="text-white">
            Bank Name
          </Label>
          <select
            id="bank-name"
            className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 border"
            disabled
          >
            <option value="">Select your bank</option>
            <option value="equity">Equity Bank</option>
            <option value="kcb">KCB Bank</option>
            <option value="coop">Co-operative Bank</option>
            <option value="standard">Standard Chartered</option>
            <option value="absa">Absa Bank</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank-amount" className="text-white">
            Amount ($)
          </Label>
          <Input
            id="bank-amount"
            type="number"
            placeholder="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white"
            min="100"
            disabled
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
              disabled
            >
              ${amt}
            </Button>
          ))}
        </div>

        <div className="border border-dashed border-purple-500 rounded-lg p-6 text-center bg-purple-900/10">
          <Banknote className="w-10 h-10 mx-auto text-purple-400 mb-3" />
          <h3 className="font-medium text-white">Bank Transfers Not allowed from your location, use phone transfer option</h3>
          <p className="text-sm text-gray-400 mt-1">
            We'll let you know.
          </p>
        </div>

        <Button
          type="button"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3"
          disabled
        >
          Pay with Bank
        </Button>
      </form>
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
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}