"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendOtpApi, verifyOtpApi } from "@/lib/api-client/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      email: (fd.get("email") as string).trim().toLowerCase(),
      password: fd.get("password") as string,
    };
    setLoading(true);
    try {
      await sendOtpApi(data);
      setFormData(data);
      setStep("otp");
      setCooldown(60);
      toast.success("Verification code sent to your email");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      await verifyOtpApi({ email: formData.email, otp: code });
      toast.success("Account created! Please sign in.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      await sendOtpApi(formData);
      setCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      toast.success("New code sent");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to resend");
    } finally {
      setLoading(false);
    }
  }, [cooldown, formData]);

  return (
    <div className="flex h-full items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold">
            {step === "details" ? "Create Account" : "Verify Email"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === "details"
              ? "Start managing your clients"
              : `Enter the code sent to ${formData.email}`}
          </p>
        </CardHeader>
        <CardContent>
          {step === "details" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" required autoFocus defaultValue={formData.name} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required defaultValue={formData.email} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required minLength={6} defaultValue={formData.password} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending code..." : "Send Verification Code"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <Input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="h-12 w-11 text-center text-lg font-semibold"
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              <Button className="w-full" onClick={handleVerify} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Create Account"}
              </Button>
              <div className="text-center">
                {cooldown > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Resend code in <span className="font-medium text-foreground">{cooldown}s</span>
                  </span>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="text-sm text-primary hover:underline"
                  >
                    Resend code
                  </button>
                )}
              </div>
              <button
                onClick={() => { setStep("details"); setOtp(["", "", "", "", "", ""]); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to details
              </button>
            </div>
          )}
          {step === "details" && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary underline">Sign in</Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
