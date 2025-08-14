import { Logger } from '@nestjs/common';

export interface RateLimitConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);
  private readonly config: Required<RateLimitConfig>;
  private lastRequestTime = 0;
  private requestCount = 0;
  private windowStart = Date.now();
  
  // Track rate limit headers
  private rateLimit = {
    total: 1000,
    remaining: 1000,
    resetTime: Date.now() + 3600000 // 1 hour from now
  };

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 5,
      initialDelay: config.initialDelay ?? 1000,
      maxDelay: config.maxDelay ?? 30000,
      backoffMultiplier: config.backoffMultiplier ?? 2
    };
  }

  /**
   * Update rate limit info from response headers
   */
  updateFromHeaders(headers: any) {
    if (headers['x-ratelimit-total']) {
      this.rateLimit.total = parseInt(headers['x-ratelimit-total']);
    }
    if (headers['x-ratelimit-remaining']) {
      this.rateLimit.remaining = parseInt(headers['x-ratelimit-remaining']);
    }
    if (headers['x-ratelimit-reset']) {
      this.rateLimit.resetTime = parseInt(headers['x-ratelimit-reset']) * 1000;
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus() {
    const now = Date.now();
    const timeUntilReset = Math.max(0, this.rateLimit.resetTime - now);
    
    return {
      remaining: this.rateLimit.remaining,
      total: this.rateLimit.total,
      percentUsed: ((this.rateLimit.total - this.rateLimit.remaining) / this.rateLimit.total) * 100,
      resetsIn: Math.ceil(timeUntilReset / 1000) // seconds
    };
  }

  /**
   * Check if we should proactively slow down
   */
  shouldSlowDown(): boolean {
    const status = this.getStatus();
    
    // Only slow down if we're really close to the limit
    // AND have a long time until reset
    if (status.remaining < 20 && status.resetsIn > 300) {
      return true;
    }
    
    // Or if we've used 95% and still have more than 2 minutes to go
    if (status.percentUsed > 95 && status.resetsIn > 120) {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate delay based on current rate limit status
   */
  getProactiveDelay(): number {
    const status = this.getStatus();
    
    // Only apply delays when really necessary
    if (status.remaining < 10) {
      return 3000; // 3 seconds when almost out
    } else if (status.remaining < 20) {
      return 1000; // 1 second when low
    } else if (status.percentUsed > 95) {
      return 500; // 500ms when at 95%
    }
    
    return 0; // No delay otherwise - let it run fast!
  }

  /**
   * Execute request with retry logic and rate limiting
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Apply proactive delay if needed
        if (this.shouldSlowDown() && attempt === 0) {
          const delay = this.getProactiveDelay();
          this.logger.debug(`Proactive rate limiting: waiting ${delay}ms (${this.rateLimit.remaining} requests remaining)`);
          await this.sleep(delay);
        }
        
        // Execute the function
        const result = await fn();
        
        // Success - reset retry state
        return result;
        
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error
        if (error.response?.status === 429) {
          if (attempt === this.config.maxRetries) {
            this.logger.error(`Max retries (${this.config.maxRetries}) exceeded for ${context || 'request'}`);
            throw error;
          }
          
          // Check for Retry-After header
          const retryAfter = error.response.headers['retry-after'];
          let delay: number;
          
          if (retryAfter) {
            // Retry-After can be in seconds or an HTTP date
            delay = isNaN(retryAfter) 
              ? new Date(retryAfter).getTime() - Date.now()
              : parseInt(retryAfter) * 1000;
            
            this.logger.warn(
              `Rate limited${context ? ` (${context})` : ''}. ` +
              `Retry-After header says wait ${Math.ceil(delay / 1000)}s ` +
              `(attempt ${attempt + 1}/${this.config.maxRetries})`
            );
          } else {
            // Use exponential backoff
            delay = Math.min(
              this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt),
              this.config.maxDelay
            );
            
            this.logger.warn(
              `Rate limited${context ? ` (${context})` : ''}. ` +
              `Using exponential backoff: ${Math.ceil(delay / 1000)}s ` +
              `(attempt ${attempt + 1}/${this.config.maxRetries})`
            );
          }
          
          await this.sleep(delay);
          continue;
        }
        
        // For non-rate-limit errors, throw immediately
        throw error;
      }
    }
    
    // Should never reach here, but just in case
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}