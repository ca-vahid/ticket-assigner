import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../database/entities/category.entity';
import { FreshserviceService } from '../integrations/freshservice/freshservice.service';
import axios from 'axios';

@Injectable()
export class SyncCategoriesCommand {
  private readonly logger = new Logger(SyncCategoriesCommand.name);

  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private freshserviceService: FreshserviceService,
  ) {}

  async execute(): Promise<{ synced: number; skipped: number }> {
    this.logger.log('🔄 Starting category sync from Freshservice custom field...');
    
    let syncedCount = 0;
    let skippedCount = 0;

    try {
      // Fetch ticket fields to get the custom "security" field with categories
      const ticketFields = await this.fetchTicketFields();
      
      // Find the "security" field which contains our categories
      const securityField = ticketFields.find((field: any) => field.name === 'security');
      
      if (!securityField) {
        this.logger.error('❌ Could not find "security" custom field in Freshservice');
        throw new Error('Security field not found');
      }

      this.logger.log(`📥 Found ${securityField.choices.length} categories in security field`);

      // Sync each category choice
      for (const choice of securityField.choices) {
        // Check if category exists
        let category = await this.categoryRepository.findOne({
          where: { freshserviceId: choice.id.toString() }
        });

        if (!category) {
          // Create new category
          category = this.categoryRepository.create({
            freshserviceId: choice.id.toString(),
            name: choice.value,
            displayId: choice.display_id,
            description: `Category from Freshservice (ID: ${choice.display_id})`,
            isActive: true,
            requiredSkills: this.mapCategoryToSkills(choice.value),
            priorityLevel: this.mapCategoryToPriority(choice.value),
            averageResolutionTime: this.estimateResolutionTime(choice.value)
          });
          
          await this.categoryRepository.save(category);
          this.logger.log(`✅ Created category: ${category.name}`);
          syncedCount++;
        } else {
          // Update existing category
          category.name = choice.value;
          category.displayId = choice.display_id;
          category.isActive = true;
          
          await this.categoryRepository.save(category);
          this.logger.log(`📝 Updated category: ${category.name}`);
          syncedCount++;
        }
      }

      this.logger.log(`✅ Category sync completed: ${syncedCount} synced`);
      return { synced: syncedCount, skipped: skippedCount };
    } catch (error) {
      this.logger.error('❌ Category sync failed:', error);
      throw error;
    }
  }

  private async fetchTicketFields(): Promise<any[]> {
    try {
      const apiKey = process.env.FRESHSERVICE_API_KEY;
      const domain = process.env.FRESHSERVICE_DOMAIN;
      
      const response = await axios.get(
        `https://${domain}/api/v2/ticket_form_fields`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(apiKey + ':X').toString('base64')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.ticket_fields || [];
    } catch (error) {
      this.logger.error('Failed to fetch ticket fields:', error);
      throw error;
    }
  }

  private mapCategoryToSkills(categoryName: string): string[] {
    // Map categories to required skills based on name
    const skillMap: Record<string, string[]> = {
      'Active Directory Tasks': ['active_directory', 'windows', 'user_management'],
      'Azure Infrastructure': ['azure', 'cloud', 'infrastructure'],
      'BST': ['bst', 'software'],
      'Network': ['networking', 'firewall', 'vpn'],
      'Hardware': ['hardware', 'desktop_support'],
      'Software': ['software', 'installation', 'troubleshooting'],
      'Email': ['exchange', 'outlook', 'email'],
      'Security': ['security', 'antivirus', 'compliance'],
      'Database': ['sql', 'database', 'backup'],
      'SharePoint': ['sharepoint', 'collaboration'],
      'Teams': ['teams', 'collaboration', 'communication'],
      'Printing': ['printers', 'hardware'],
      'Mobile': ['mobile', 'mdm', 'phones'],
      'VPN': ['vpn', 'networking', 'remote_access'],
      'Backup': ['backup', 'recovery', 'storage']
    };

    // Find matching skills for this category
    for (const [key, skills] of Object.entries(skillMap)) {
      if (categoryName.toLowerCase().includes(key.toLowerCase())) {
        return skills;
      }
    }

    // Default skills if no match
    return ['general_support'];
  }

  private mapCategoryToPriority(categoryName: string): string {
    // Map categories to priority levels
    if (categoryName.toLowerCase().includes('security') || 
        categoryName.toLowerCase().includes('critical')) {
      return 'L3';
    }
    if (categoryName.toLowerCase().includes('azure') || 
        categoryName.toLowerCase().includes('infrastructure') ||
        categoryName.toLowerCase().includes('database')) {
      return 'L2';
    }
    return 'L1';
  }

  private estimateResolutionTime(categoryName: string): number {
    // Estimate resolution time in hours based on category
    const timeMap: Record<string, number> = {
      'password': 1,
      'email': 2,
      'software': 3,
      'hardware': 4,
      'network': 4,
      'azure': 6,
      'infrastructure': 8,
      'project': 16,
      'security': 8,
      'database': 6
    };

    // Find matching time estimate
    for (const [key, hours] of Object.entries(timeMap)) {
      if (categoryName.toLowerCase().includes(key)) {
        return hours;
      }
    }

    // Default resolution time
    return 4;
  }
}