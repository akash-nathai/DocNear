import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { MAX_FAMILY_MEMBERS } from '../../common/constants';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { CreateFamilyMemberDto } from './dto/create-family-member.dto';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // ── Profile ───────────────────────────────────────────────────────────────

  async getMyProfile(userId: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      include: { user: true, familyMembers: true },
    });
    if (!profile) throw new NotFoundException('Patient profile not found');
    return this.formatProfile(profile);
  }

  async updateMyProfile(userId: string, dto: UpdatePatientDto) {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Patient profile not found');

    const data: Record<string, unknown> = {};
    if (dto.dob !== undefined) {
      data['dobEnc'] = this.crypto.encrypt(dto.dob);
    }
    if (dto.bloodGroup !== undefined) data['bloodGroup'] = dto.bloodGroup;
    if (dto.gender !== undefined) data['gender'] = dto.gender;
    if (dto.allergies !== undefined) {
      data['allergiesEnc'] = this.crypto.encrypt(dto.allergies);
    }
    if (dto.chronicConditions !== undefined) {
      data['chronicConditionsEnc'] = this.crypto.encrypt(dto.chronicConditions);
    }

    const updated = await this.prisma.patientProfile.update({
      where: { userId },
      data,
      include: { user: true, familyMembers: true },
    });
    return this.formatProfile(updated);
  }

  // ── Family Members ────────────────────────────────────────────────────────

  async listFamilyMembers(userId: string) {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Patient profile not found');
    const members = await this.prisma.familyMember.findMany({
      where: { patientId: profile.id },
      orderBy: { createdAt: 'asc' },
    });
    return members;
  }

  async addFamilyMember(userId: string, dto: CreateFamilyMemberDto) {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Patient profile not found');

    const count = await this.prisma.familyMember.count({ where: { patientId: profile.id } });
    if (count >= MAX_FAMILY_MEMBERS) {
      throw new ConflictException(`Maximum ${MAX_FAMILY_MEMBERS} family members allowed`);
    }

    return this.prisma.familyMember.create({
      data: {
        id: randomUUID(),
        patientId: profile.id,
        name: dto.name,
        relation: dto.relation,
        dob: dto.dob ? new Date(dto.dob) : null,
        gender: dto.gender ?? null,
        bloodGroup: dto.bloodGroup ?? null,
        allergies: dto.allergies ?? [],
      },
    });
  }

  async removeFamilyMember(userId: string, memberId: string) {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Patient profile not found');

    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, patientId: profile.id },
    });
    if (!member) throw new NotFoundException('Family member not found');

    await this.prisma.familyMember.delete({ where: { id: memberId } });
    return { message: 'Family member removed' };
  }

  // ── Admin: get any patient (SUPER_ADMIN only) ──────────────────────────────

  async getPatientByUserId(requestorRole: string, targetUserId: string) {
    if (requestorRole !== 'SUPER_ADMIN') throw new ForbiddenException('Access denied');
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId: targetUserId },
      include: { user: true, familyMembers: true },
    });
    if (!profile) throw new NotFoundException('Patient not found');
    return this.formatProfile(profile);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatProfile(profile: any) {
    return {
      id: profile.id,
      userId: profile.userId,
      bloodGroup: profile.bloodGroup,
      gender: profile.gender,
      verificationStatus: profile.verificationStatus,
      // Decrypt PHI fields
      dob: profile.dobEnc && profile.dobEnc.length > 0
        ? this.crypto.decrypt(profile.dobEnc as Buffer)
        : null,
      allergies: profile.allergiesEnc && profile.allergiesEnc.length > 0
        ? this.crypto.decrypt(profile.allergiesEnc as Buffer)
        : null,
      chronicConditions:
        profile.chronicConditionsEnc && profile.chronicConditionsEnc.length > 0
          ? this.crypto.decrypt(profile.chronicConditionsEnc as Buffer)
          : null,
      familyMembers: profile.familyMembers ?? [],
      createdAt: profile.createdAt,
    };
  }
}
