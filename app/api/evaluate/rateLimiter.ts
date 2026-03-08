// Simple in-memory rate limiter
// 10 requests per hour per wallet address

interface RateLimitEntry {
  count: number;
  resetTime: number; // Timestamp when the limit resets
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_REQUESTS_PER_HOUR = 10;

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [address, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(address);
    }
  }
}, 5 * 60 * 1000);

export function checkRateLimit(walletAddress: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const normalizedAddress = walletAddress.toLowerCase();
  
  const entry = rateLimitMap.get(normalizedAddress);
  
  if (!entry) {
    // First request for this address
    rateLimitMap.set(normalizedAddress, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_HOUR - 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    };
  }
  
  // Check if window has expired
  if (now > entry.resetTime) {
    // Reset the counter
    rateLimitMap.set(normalizedAddress, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_HOUR - 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= MAX_REQUESTS_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetTime,
    };
  }
  
  // Increment counter
  entry.count++;
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_HOUR - entry.count,
    resetAt: entry.resetTime,
  };
}
