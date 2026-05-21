import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PharmacyOrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { ListProductsDto } from './dto/list-products.dto';
import { CreatePharmacyOrderDto } from './dto/create-order.dto';

const DELIVERY_CHARGE_PAISE = 4900; // ₹49
const FREE_DELIVERY_THRESHOLD_PAISE = 50000; // ₹500
const ORDER_REF_PREFIX = 'PH';

@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Products ──────────────────────────────────────────────────────────────

  async listProducts(dto: ListProductsDto) {
    const { page, limit, search, categoryId, prescriptionRequired } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isActive: true };
    if (categoryId) where['categoryId'] = categoryId;
    if (prescriptionRequired !== undefined) where['prescriptionRequired'] = prescriptionRequired;
    if (search) {
      where['OR'] = [
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.pharmacyProduct.findMany({
        where,
        include: { category: true },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.pharmacyProduct.count({ where }),
    ]);

    return {
      data: products,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getProduct(productId: string) {
    const product = await this.prisma.pharmacyProduct.findUnique({
      where: { id: productId },
      include: { category: true },
    });
    if (!product || !product.isActive) throw new NotFoundException('Product not found');
    return product;
  }

  async listCategories() {
    return this.prisma.pharmacyCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  async createOrder(userId: string, dto: CreatePharmacyOrderDto) {
    const patient = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!patient) throw new ForbiddenException('Only patients can place pharmacy orders');

    // Fetch all products
    const productIds = dto.items.map(i => i.productId);
    const products = await this.prisma.pharmacyProduct.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found or unavailable');
    }

    // Prescription check
    const needsRx = products.some(p => p.prescriptionRequired);
    if (needsRx && !dto.prescriptionUrl) {
      throw new BadRequestException(
        'A prescription is required for one or more items in your cart',
      );
    }

    // Build item snapshot + stock check
    type OrderItemSnapshot = {
      productId: string;
      name: string;
      sku: string;
      quantity: number;
      unitPricePaise: number;
      subtotalPaise: number;
    };
    const itemSnapshots: OrderItemSnapshot[] = [];
    let subtotalPaise = 0;

    for (const item of dto.items) {
      const product = products.find(p => p.id === item.productId)!;
      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }
      const lineTotal = product.pricePaise * item.quantity;
      subtotalPaise += lineTotal;
      itemSnapshots.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPricePaise: product.pricePaise,
        subtotalPaise: lineTotal,
      });
    }

    // Delivery charge
    const deliveryChargePaise =
      subtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE ? 0 : DELIVERY_CHARGE_PAISE;

    // Coupon
    let discountPaise = 0;
    let couponId: string | null = null;
    if (dto.couponCode) {
      const coupon = await this.prisma.coupon.findUnique({ where: { code: dto.couponCode } });
      if (
        coupon &&
        coupon.isActive &&
        coupon.validFrom <= new Date() &&
        coupon.validUntil >= new Date() &&
        coupon.applicableTo !== 'BOOKING'
      ) {
        if (coupon.type === 'FLAT') {
          discountPaise = Math.min(coupon.value, subtotalPaise);
        } else {
          const raw = Math.floor((subtotalPaise * coupon.value) / 100);
          discountPaise = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
        }
        couponId = coupon.id;
      }
    }

    const totalPaise = subtotalPaise + deliveryChargePaise - discountPaise;
    const orderRef = `${ORDER_REF_PREFIX}-${Date.now()}`;

    const order = await this.prisma.$transaction(async tx => {
      // Decrement stock
      for (const item of dto.items) {
        await tx.pharmacyProduct.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      return tx.pharmacyOrder.create({
        data: {
          id: randomUUID(),
          orderRef,
          patientId: patient.id,
          items: itemSnapshots,
          subtotalPaise,
          deliveryChargePaise,
          discountPaise,
          totalPaise,
          couponId,
          deliveryAddress: dto.deliveryAddress as object,
          prescriptionUrl: dto.prescriptionUrl ?? null,
          notes: dto.notes ?? null,
          status: PharmacyOrderStatus.PLACED,
        },
      });
    });

    return order;
  }

  async listMyOrders(userId: string, page = 1, limit = 10) {
    const patient = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!patient) return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };

    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.prisma.pharmacyOrder.findMany({
        where: { patientId: patient.id },
        orderBy: { placedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pharmacyOrder.count({ where: { patientId: patient.id } }),
    ]);

    return {
      data: orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrder(userId: string, role: string, orderId: string) {
    const order = await this.prisma.pharmacyOrder.findUnique({
      where: { id: orderId },
      include: { patient: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (role === Role.PATIENT && order.patient.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return order;
  }

  // ── Admin: update order status ────────────────────────────────────────────

  async updateOrderStatus(orderId: string, status: PharmacyOrderStatus) {
    const order = await this.prisma.pharmacyOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    return this.prisma.pharmacyOrder.update({ where: { id: orderId }, data: { status } });
  }
}
