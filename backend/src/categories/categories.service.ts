import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../database/entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoryRepository.find();
  }

  async findOne(id: string): Promise<Category> {
    return this.categoryRepository.findOne({ where: { id } });
  }

  async findByCategoryId(categoryId: number): Promise<Category> {
    return this.categoryRepository.findOne({ 
      where: { freshserviceId: categoryId.toString() } 
    });
  }

  async create(data: Partial<Category>): Promise<Category> {
    const category = this.categoryRepository.create(data);
    return this.categoryRepository.save(category);
  }

  async update(id: string, data: Partial<Category>): Promise<Category> {
    await this.categoryRepository.update(id, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.categoryRepository.delete(id);
  }
}