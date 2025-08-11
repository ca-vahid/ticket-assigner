import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FreshserviceService } from '../integrations/freshservice/freshservice.service';

export interface SecurityCategory {
  id: string;
  name: string;
  description?: string;
  ticketCount?: number;
  lastUpdated?: Date;
}

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);
  private cachedCategories: SecurityCategory[] = [];
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  constructor(
    private freshserviceService: FreshserviceService,
  ) {}

  /**
   * Get all available security categories
   */
  async getCategories(forceRefresh = false): Promise<SecurityCategory[]> {
    // Return cached categories if still valid
    if (!forceRefresh && this.lastFetch && this.cachedCategories.length > 0) {
      const cacheAge = Date.now() - this.lastFetch.getTime();
      if (cacheAge < this.CACHE_DURATION) {
        return this.cachedCategories;
      }
    }

    try {
      // Fetch ticket form fields from Freshservice to get dropdown values
      const categories = await this.fetchSecurityDropdownValues();
      
      this.cachedCategories = categories;
      this.lastFetch = new Date();
      
      this.logger.log(`Fetched ${categories.length} security categories`);
      return categories;
    } catch (error) {
      this.logger.error('Failed to fetch categories:', error);
      return this.cachedCategories; // Return cached if fetch fails
    }
  }

  /**
   * Fetch security dropdown values from Freshservice
   */
  private async fetchSecurityDropdownValues(): Promise<SecurityCategory[]> {
    try {
      // Try to get ticket fields to find the security dropdown
      const fields = await this.freshserviceService.getTicketFields();
      
      const securityField = fields?.find(field => 
        field.name === 'security' || 
        field.label?.toLowerCase() === 'security' ||
        field.name === 'cf_security'
      );

      if (securityField && securityField.choices) {
        return securityField.choices.map(choice => ({
          id: choice.id || choice.value,
          name: choice.value || choice.label,
          description: choice.label
        }));
      }

      // Fallback: Analyze recent tickets to extract unique security values
      return await this.extractCategoriesFromTickets();
    } catch (error) {
      this.logger.error('Failed to fetch security dropdown values:', error);
      return await this.extractCategoriesFromTickets();
    }
  }

  /**
   * Extract unique categories from recent tickets
   */
  private async extractCategoriesFromTickets(): Promise<SecurityCategory[]> {
    try {
      this.logger.log('Extracting categories from recent tickets...');
      
      // Fetch recent tickets
      const tickets = await this.freshserviceService.getTickets({
        per_page: 100,
        order_by: 'created_at',
        order_type: 'desc'
      });

      const categoryMap = new Map<string, number>();

      for (const ticket of tickets) {
        const category = ticket.custom_fields?.security || 
                        ticket.custom_fields?.cf_security;
        
        if (category) {
          const count = categoryMap.get(category) || 0;
          categoryMap.set(category, count + 1);
        }
      }

      const categories: SecurityCategory[] = [];
      for (const [name, count] of categoryMap.entries()) {
        categories.push({
          id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name,
          ticketCount: count
        });
      }

      // Sort by ticket count (most used first)
      categories.sort((a, b) => (b.ticketCount || 0) - (a.ticketCount || 0));

      this.logger.log(`Extracted ${categories.length} unique categories from tickets`);
      return categories;
    } catch (error) {
      this.logger.error('Failed to extract categories from tickets:', error);
      return [];
    }
  }

  /**
   * Sync categories from Freshservice (for scheduled jobs)
   */
  async syncCategories(): Promise<{ success: boolean; count: number }> {
    try {
      const categories = await this.getCategories(true);
      return { success: true, count: categories.length };
    } catch (error) {
      this.logger.error('Failed to sync categories:', error);
      return { success: false, count: 0 };
    }
  }
}