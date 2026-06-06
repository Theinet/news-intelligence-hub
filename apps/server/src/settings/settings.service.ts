import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../common/prisma.service';
import {QueuesService} from '../jobs/queues.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService
  ) {}

  categories(userId: string) {
    return this.prisma.category.findMany({where: {userId}, orderBy: {name: 'asc'}});
  }

  createCategory(userId: string, body: {name: string; description?: string}) {
    const data = {
      name: cleanRequiredText(body.name, 'Category name'),
      description: body.description?.trim() || undefined
    };
    return this.prisma.category.create({data: {userId, ...data}});
  }

  async updateCategory(userId: string, id: string, body: {name?: string; description?: string}) {
    const category = await this.prisma.category.findFirst({where: {id, userId}});
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.prisma.category.update({where: {id}, data: cleanCategoryInput(body)});
  }

  async deleteCategory(userId: string, id: string): Promise<void> {
    const category = await this.prisma.category.findFirst({where: {id, userId}});
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    await this.prisma.category.delete({where: {id}});
  }

  axes(userId: string) {
    return this.prisma.categoryAxis.findMany({where: {userId}, orderBy: {createdAt: 'asc'}});
  }

  createAxis(userId: string, body: {name: string; values: string[]}) {
    const data = {
      name: cleanRequiredText(body.name, 'Axis name'),
      values: cleanAxisValues(body.values)
    };
    return this.prisma.categoryAxis.create({data: {userId, ...data}});
  }

  async updateAxis(userId: string, id: string, body: {name?: string; values?: string[]}) {
    const axis = await this.prisma.categoryAxis.findFirst({where: {id, userId}});
    if (!axis) {
      throw new NotFoundException('Axis not found');
    }
    return this.prisma.categoryAxis.update({where: {id}, data: cleanAxisInput(body)});
  }

  async deleteAxis(userId: string, id: string): Promise<void> {
    const axis = await this.prisma.categoryAxis.findFirst({where: {id, userId}});
    if (!axis) {
      throw new NotFoundException('Axis not found');
    }
    await this.prisma.categoryAxis.delete({where: {id}});
  }

  async startRegeneration(userId: string) {
    const total = await this.prisma.article.count({where: {userId, status: 'processed'}});
    const run = await this.prisma.regenerationRun.create({data: {userId, total}});
    await this.queues.regeneration.add('regeneration.start', {userId, regenerationId: run.id});
    return run;
  }

  async regeneration(userId: string, id: string) {
    const run = await this.prisma.regenerationRun.findFirst({where: {id, userId}});
    if (!run) {
      throw new NotFoundException('Regeneration run not found');
    }
    return run;
  }
}

function cleanCategoryInput(body: {name?: string; description?: string}): {name?: string; description?: string} {
  const data: {name?: string; description?: string} = {};
  if (body.name !== undefined) {
    data.name = cleanRequiredText(body.name, 'Category name');
  }
  if (body.description !== undefined) {
    data.description = body.description.trim() || undefined;
  }
  return data;
}

function cleanAxisInput(body: {name?: string; values?: string[]}): {name?: string; values?: string[]} {
  const data: {name?: string; values?: string[]} = {};
  if (body.name !== undefined) {
    data.name = cleanRequiredText(body.name, 'Axis name');
  }
  if (body.values !== undefined) {
    data.values = cleanAxisValues(body.values);
  }
  return data;
}

function cleanAxisValues(values: string[]): string[] {
  const cleanValues = values.map((value) => value.trim()).filter(Boolean);
  if (cleanValues.length === 0) {
    throw new BadRequestException('Axis values are required');
  }
  return cleanValues;
}

function cleanRequiredText(value: string, fieldName: string): string {
  const cleanValue = value.trim();
  if (!cleanValue) {
    throw new BadRequestException(`${fieldName} is required`);
  }
  return cleanValue;
}
