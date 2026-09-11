/**
 * Relevance Engine
 * Calculates customer insurance battery health (0-100%)
 * based on 4 signal sources:
 * 1. Bank transactions & existing KYC
 * 2. Customer self-reported assessment / profile
 * 3. Hospital & Health App Touchpoints (with double opt-in consent)
 * 4. Broker confirmed updates
 */

export function calculateBatteryScore({ profile = {}, selectedCategories = {}, policies = [], lifeEvents = [] }) {
  const reasons = [];
  const gaps = [];

  // --- Helper Policy Checks ---
  const hasHealthPolicy = policies.some(p => p.category === 'health_ci' || p.category === 'health' || (p.product_name && p.product_name.includes('Health')));
  const hasCIPolicy = policies.some(p => p.category === 'health_ci' || (p.product_name && (p.product_name.includes('CI') || p.product_name.includes('โรคร้ายแรง'))));
  const hasLifePolicy = policies.some(p => p.category === 'whole_life' || p.category === 'term_life' || (p.product_name && p.product_name.includes('Life')));
  const hasSavingsPolicy = policies.some(p => p.category === 'savings' || p.category === 'unit_linked' || (p.product_name && p.product_name.includes('ออม')));
  const hasPensionPolicy = policies.some(p => p.category === 'pension' || p.category === 'annuity' || (p.product_name && p.product_name.includes('บำนาญ')));
  const hasAccidentPolicy = policies.some(p => p.category === 'accident' || (p.product_name && p.product_name.includes('อุบัติเหตุ')) || (p.product_name && p.product_name.includes('PA')));

  // --- Parse Age ---
  let age = 35;
  if (profile.age) {
    // Safely parse age from number or range string (e.g., "50-60" -> 50)
    if (typeof profile.age === 'number' && !isNaN(profile.age)) {
      age = profile.age;
    } else if (typeof profile.age === 'string') {
      const match = profile.age.match(/\d+/);
      if (match) age = parseInt(match[0], 10);
    }
  }

  // ==========================================
  // PILLAR 1: Health & Critical Illness (Max 25 pts)
  // ==========================================
  let p1_health = 0;
  const welfare = profile.welfare || 'social_security';
  if (welfare === 'group_insurance') {
    p1_health += 12;
    reasons.push('มีสวัสดิการประกันกลุ่มขององค์กรรองรับค่ารักษาพยาบาลเบื้องต้น (OPD/IPD)');
  } else if (welfare === 'government') {
    p1_health += 14;
    reasons.push('มีสิทธิข้าราชการ/รัฐวิสาหกิจ ช่วยคุ้มครองค่ารักษาพยาบาล รพ.รัฐได้ครอบคลุม');
  } else if (welfare === 'social_security') {
    p1_health += 8;
    reasons.push('มีสิทธิประกันสังคมช่วยรองรับค่ารักษาพยาบาลพื้นฐานตาม รพ.คู่สัญญา');
  } else {
    p1_health += 0;
    reasons.push('ไม่มีสวัสดิการค่ารักษาพยาบาลขององค์กร แบกรับความเสี่ยงค่ารักษาเอกชนเอง 100%');
  }

  if (hasHealthPolicy) {
    p1_health += 10;
    reasons.push('มีประกันสุขภาพส่วนบุคคลช่วยเติมเต็มและคุ้มครองค่ารักษาพยาบาลแบบเหมาจ่าย');
  } else {
    if (welfare === 'none') {
      gaps.push('Krungsri First Class Health (เหมาจ่ายค่ารักษา)');
    } else {
      gaps.push('Krungsri Health Protection Plus (เหมาจ่าย)');
    }
  }

  if (hasCIPolicy) {
    p1_health += 3;
    reasons.push('มีสัญญาเพิ่มเติมคุ้มครองโรคร้ายแรง (Critical Illness) ในพอร์ตแล้ว');
  } else if (age >= 40 || profile.primary_concern === 'critical_illness') {
    gaps.push('Krungsri Multi-Pay Critical Illness');
    reasons.push('ยังไม่มีสัญญาคุ้มครองโรคร้ายแรงระยะลุกลาม แนะนำเสริมทุนก้อนเพื่อความอุ่นใจ');
  }

  // Hospital signal factor adjustment
  const recentHospitalEvent = lifeEvents.find(e => e.source && e.source.includes('Hospital'));
  if (recentHospitalEvent && !hasHealthPolicy) {
    p1_health = Math.max(0, p1_health - 4);
    const isPreparingChild = profile.family_status === 'preparing' ||
      (selectedCategories && (selectedCategories.maternity || (Array.isArray(selectedCategories) && selectedCategories.includes('maternity'))));
    
    if (isPreparingChild) {
      reasons.push('ตรวจพบสัญญาณ Life-Event ทางการแพทย์และอยู่ในช่วงเตรียมมีบุตร แนะนำเสริมความคุ้มครองแม่และเด็ก');
      gaps.push('Maternity & Newborn Infant Care Rider');
    } else {
      reasons.push('ตรวจพบประวัติเข้ารับการตรวจสุขภาพประจำปี แนะนำวางแผนประกันสุขภาพเหมาจ่ายเพื่อช่วยรองรับค่ารักษาพยาบาล');
      gaps.push('Krungsri Health Protection Plus (เหมาจ่าย)');
    }
  }

  // ==========================================
  // PILLAR 2: Life, Family & Debt Protection (Max 25 pts)
  // ==========================================
  let p2_life = 0;
  const familyStatus = profile.family_status || '';
  const isSingle = familyStatus === 'single';
  const hasDependent = !isSingle && (familyStatus.includes('บุตร') || familyStatus.includes('สมรส') || familyStatus === 'married_children' || familyStatus === 'preparing' || familyStatus === 'married');

  if (isSingle) {
    p2_life += 14; // Singles have fewer dependent obligations
    reasons.push('สถานะโสด ไม่มีภาระผู้พึ่งพิงทางการเงิน ทุนประกันเน้นคุ้มครองตนเอง');
  } else {
    p2_life += 6; // Families need more life insurance to be fully covered
    reasons.push('มีภาระครอบครัวและผู้พึ่งพิง จำเป็นต้องมีทุนประกันชีวิตเพื่อส่งต่อความมั่นคง');
  }

  if (hasLifePolicy) {
    p2_life += 11;
    reasons.push('มีกรมธรรม์ประกันชีวิตหลักสร้างหลักประกันมรดกแก่ครอบครัวเรียบร้อยแล้ว');
  } else if (hasSavingsPolicy) {
    p2_life += 7;
    reasons.push('มีประกันสะสมทรัพย์ช่วยสร้างทุนสำรองและมีวงเงินคุ้มครองชีวิตควบคู่');
  } else if (hasDependent) {
    gaps.push('Krungsri Whole Life & Family Inheritance');
  }

  const debt = profile.debt_burden || 'no_debt';
  if (debt === 'no_debt') {
    p2_life += 4;
    reasons.push('ไม่มีภาระหนี้สินผูกพัน ช่วยเพิ่มความยืดหยุ่นทางการเงินและศักยภาพในการออม');
  } else if (debt === 'mortgage_high') {
    if (hasLifePolicy || hasSavingsPolicy) {
      p2_life += 4;
      reasons.push('มีทุนประกันชีวิตช่วยรองรับภาระผ่อนที่อยู่อาศัย ไม่ทิ้งหนี้สินให้ครอบครัว');
    } else {
      gaps.push('Krungsri Mortgage Protection & Whole Life');
      reasons.push('มีภาระผ่อนที่อยู่อาศัยก้อนใหญ่ ควรมีทุนประกันชีวิตครอบคลุมยอดหนี้สินคงค้าง');
    }
  } else if (debt === 'car_or_personal') {
    if (hasLifePolicy || hasAccidentPolicy) {
      p2_life += 3;
    } else {
      reasons.push('มีภาระสินเชื่อหมุนเวียน ควรมีทุนคุ้มครองครอบคลุมระยะเวลาผ่อนชำระ');
    }
  }

  // ==========================================
  // PILLAR 3: Emergency & Income Protection (Max 20 pts)
  // ==========================================
  let p3_income = 0;
  const occupation = profile.occupation || 'employee';
  if (occupation === 'employee' || occupation === 'government') {
    p3_income += 10;
    reasons.push('มีรายได้ประจำสม่ำเสมอ เสถียรภาพทางการเงินมั่นคง');
  } else if (occupation === 'retired') {
    p3_income += 8;
  } else {
    p3_income += 4; // Freelance / Business Owner at higher income risk
    reasons.push('อาชีพอิสระ/เจ้าของกิจการ รายได้ผันผวน ควรมีแผนชดเชยรายได้รายวัน');
    if (!hasAccidentPolicy) gaps.push('Daily Hospital Cash Relief & Accident Shield');
  }

  if (hasAccidentPolicy) {
    p3_income += 10;
    reasons.push('มีประกันอุบัติเหตุส่วนบุคคล (PA) คุ้มครองความเสี่ยง 24 ชั่วโมง');
  } else {
    gaps.push('Accident Shield Plus');
  }

  // ==========================================
  // PILLAR 4: Savings & Retirement (Max 20 pts)
  // ==========================================
  let p4_savings = 0;
  if (hasSavingsPolicy) {
    p4_savings += 10;
    reasons.push('มีประกันสะสมทรัพย์ช่วยสร้างวินัยการออมและรับเงินคืนการันตี');
  } else {
    gaps.push('Krungsri Guaranteed Savings Plus');
  }

  if (hasPensionPolicy) {
    p4_savings += 8;
    reasons.push('มีประกันบำนาญเตรียมความพร้อมสำหรับกระแสเงินสดหลังเกษียณ');
  } else if (profile.primary_concern === 'retirement_shortage' || age >= 45) {
    gaps.push('Krungsri Pension 85/55 (ลดหย่อนภาษี 200,000 บาท)');
    reasons.push('ควรวางแผนประกันบำนาญเพื่อการันตีเงินบำนาญต่อเนื่องทุกปีหลังเกษียณ');
  }

  if (age <= 29) {
    p4_savings += 2;
    reasons.push('เริ่มวางแผนตั้งแต่อายุน้อย ได้เปรียบด้านอัตราเบี้ยประกันและระยะเวลาสะสมผลประโยชน์');
  }

  // ==========================================
  // PILLAR 5: Primary Concern & Intent Bonus (Max 10 pts)
  // ==========================================
  let p5_bonus = 6; // Baseline engagement for completing self-assessment

  const concern = profile.primary_concern;
  if (concern === 'medical_cost') {
    p5_bonus += hasHealthPolicy ? 4 : 1;
  } else if (concern === 'critical_illness') {
    p5_bonus += hasCIPolicy ? 4 : 1;
  } else if (concern === 'family_burden') {
    p5_bonus += hasLifePolicy ? 4 : 1;
  } else if (concern === 'retirement_shortage') {
    p5_bonus += hasPensionPolicy ? 4 : 1;
  } else {
    p5_bonus += 2;
  }

  const income = profile.income_bracket || '';
  if (income === 'over_70k') {
    reasons.push('ฐานรายได้อยู่ในเกณฑ์ที่ได้รับสิทธิประโยชน์สูงสุดจากการวางแผนลดหย่อนภาษี (สูงสุด 300,000 บาท/ปี)');
  }

  // --- Tier 2 Selected Demands (Add Recommendations without penalizing!) ---
  if (selectedCategories) {
    const hasCat = (key) => !!selectedCategories[key];

    if (hasCat('health_ci') && !hasHealthPolicy) {
      gaps.push('Krungsri Health Protection Plus (เหมาจ่าย)');
      reasons.push('สนใจหมวดสุขภาพ & โรคร้ายแรง: ระบบจัดสรรแผนเหมาจ่ายเป็นอันดับแรก');
    }
    if (hasCat('accident') && !hasAccidentPolicy) {
      gaps.push('Accident Shield Plus');
    }
    if (hasCat('savings') && !hasSavingsPolicy) {
      gaps.push('Krungsri Guaranteed Savings Plus');
    }
    if (hasCat('pension') && !hasPensionPolicy) {
      gaps.push('Krungsri Pension 85/55');
    }
    if (hasCat('life') && !hasLifePolicy) {
      gaps.push('Krungsri Whole Life Protection');
    }
    if (hasCat('mortgage') && !hasLifePolicy) {
      gaps.push('Krungsri Home & Mortgage Protection');
    }
  }

  // Calculate final score
  const totalScore = p1_health + p2_life + p3_income + p4_savings + p5_bonus;
  const score = Math.max(25, Math.min(98, Math.round(totalScore)));

  let status = 'optimal';
  if (score < 50) {
    status = 'critical';
  } else if (score < 80) {
    status = 'review';
  }

  const uniqueGaps = [...new Set(gaps)];
  const uniqueReasons = [...new Set(reasons)];

  return {
    battery_score: score,
    battery_status: status,
    reasons: uniqueReasons.length > 0 ? uniqueReasons : ['กรมธรรม์ที่มีอยู่ยังครอบคลุมความเสี่ยงตามวัยและบริบทชีวิตในปัจจุบันได้ดี'],
    recommended_riders: uniqueGaps
  };
}


export default {
  calculateBatteryScore
};
