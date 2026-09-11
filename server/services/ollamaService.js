const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

/**
 * Helper to call Ollama generate API
 */
async function callOllama(prompt, system = '') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        system,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.warn(`[Ollama Service] Warning: ${error.message}. Returning intelligent fallback response.`);
    return null;
  }
}

/**
 * Customer AI Coverage Copilot Chat
 */
export async function chatWithCopilot(messages, customerContext = {}) {
  const system = `คุณคือ "Coverage Pulse Copilot" ผู้ช่วยอัจฉริยะด้านการวางแผนความคุ้มครองของธนาคารกรุงศรีอยุธยา (Krungsri)
หน้าที่ของคุณคือ:
1. อธิบายระดับแบตเตอรี่ความคุ้มครอง (เขียว >80%, เหลือง 50-79%, แดง <50%) ให้เข้าใจง่าย เป็นกันเอง และสุภาพ
2. แนะนำหมวดประกันหรือสัญญาเพิ่มเติมที่น่าสนใจตามบริบทชีวิตของลูกค้า
3. ให้ข้อมูลเชิงความรู้เท่านั้น *ห้ามคำนวณเบี้ยประกันเป็นตัวเลขทางกฎหมาย ห้ามทำการพิจารณารับประกัน (No Underwriting) และห้ามออกเอกสารผูกพันสัญญา*
4. แนะนำให้ลูกค้ากดปุ่ม "อยากคุยกับที่ปรึกษา" หรือนัดหมายโบรกเกอร์ผู้เชี่ยวชาญหากต้องการคำแนะนำเฉพาะเจาะจง
บริบทลูกค้าปัจจุบัน:
ชื่อ: ${customerContext.name || 'คุณลูกค้า'}
อายุ: ${customerContext.age || '-'} ปี, สถานะ: ${customerContext.family_status || '-'}
ระดับแบตเตอรี่ปัจจุบัน: ${customerContext.battery_score || 50}% (${customerContext.battery_status || 'review'})
เหตุผลจุดเปราะบาง: ${JSON.stringify(customerContext.battery_reasons || [])}`;

  const lastUserMsg = messages[messages.length - 1]?.content || 'สวัสดีครับ ช่วยดูสถานะความคุ้มครองของผมหน่อย';

  // Build dialogue prompt
  const conversationHistory = messages.slice(-5).map(m => `${m.role === 'user' ? 'ลูกค้า' : 'Copilot'}: ${m.content}`).join('\n');
  const prompt = `${conversationHistory}\nCopilot:`;

  const aiReply = await callOllama(prompt, system);
  if (aiReply) {
    return aiReply.trim();
  }

  // Fallback if Ollama takes too long
  return `สวัสดีครับคุณ ${customerContext.name || 'ลูกค้า'} จากการประเมินสถานะความคุ้มครองปัจจุบัน แบตเตอรี่ของคุณอยู่ที่ระดับ ${customerContext.battery_score || 50}% ซึ่งอยู่ในเกณฑ์ที่ควรทบทวนครับ เนื่องจากมีการเปลี่ยนแปลงในบริบทชีวิต คุณสามารถทดลองเพิ่มสัญญาเพิ่มเติมใน Sandbox เพื่อดูระดับแบตเตอรี่ที่ฟื้นตัวขึ้นได้เลยครับ หรือหากต้องการวางแผนเชิงลึก สามารถกดปุ่ม "อยากคุย" เพื่อให้ที่ปรึกษาของกรุงศรีติดต่อกลับได้ทันทีครับ`;
}

/**
 * Next-Best-Action (NBA) for Broker
 */
export async function generateNextBestAction(customer, lifeEvents = [], policies = []) {
  const system = `คุณคือ AI ผู้ช่วยวิเคราะห์ผลิตภัณฑ์ประกันภัยและ Next-Best-Action (NBA) ของโบรกเกอร์กรุงศรี
วิเคราะห์บริบทลูกค้า สัญญาณ Life-Event และกรมธรรม์เดิม เพื่อแนะนำสัญญาเพิ่มเติม (Rider) หรือแผนประกันที่ตรงใจและทันท่วงทีที่สุด
ตอบเป็นภาษาไทย กระชับ ไม่เกิน 3 ย่อหน้า ประกอบด้วย:
1. Next-Best-Action (ผลิตภัณฑ์ที่ควรแนะนำ)
2. เหตุผลทางธุรกิจและเหตุการณ์ชีวิตที่รองรับ
3. ข้อควรระวังด้าน PDPA/ความยินยอม`;

  const prompt = `ข้อมูลลูกค้า:
- ชื่อ: ${customer.name}, อายุ: ${customer.age}, อาชีพ: ${customer.occupation}
- สถานะครอบครัว: ${customer.family_status}, รายได้: ${customer.income_bracket}
- แบตเตอรี่ปัจจุบัน: ${customer.battery_score}% (${customer.battery_status})
- เหตุการณ์ชีวิตล่าสุด: ${lifeEvents.map(e => `${e.title} (${e.source})`).join(', ') || 'ไม่มีสัญญาณใหม่'}
- กรมธรรม์เดิมที่มี: ${policies.map(p => p.product_name).join(', ') || 'ไม่มี'}`;

  const result = await callOllama(prompt, system);
  if (result) {
    return result.trim();
  }

  // Fallback
  return `**Next-Best-Action (NBA):** แนะนำแผนสัญญาเพิ่มเติม "กรุงศรี เฮลท์ โพรเทคชั่น พลัส (แผนเหมาจ่าย)" พร้อมความคุ้มครองบุตรแรกเกิด\n\n**เหตุผลรองรับ:** ตรวจพบสัญญาณจากโรงพยาบาลพันธมิตร (BDMS) เรื่องการเตรียมมีบุตร ขณะที่กรมธรรม์เดิมมีเพียงประกันสะสมทรัพย์ การเสริมสัญญาความคุ้มครองสุขภาพจะช่วยปิดช่องโหว่ความเสี่ยงค่ารักษาพยาบาลได้อย่างตรงจุด\n\n**ข้อควรระวัง PDPA:** สัญญาณตรวจพบผ่านระบบ Double Opt-in ที่ลูกค้าให้ความยินยอมแล้ว สามารถเปิดบทสนทนาด้วยความใส่ใจได้โดยไม่ต้องอ้างอิงข้อมูลทางการแพทย์เชิงลึก`;
}

/**
 * Pre-call Script for Broker
 */
export async function generatePreCallScript(customer, lifeEvents = [], policies = [], warmLead = null) {
  const system = `คุณคือ AI ออกแบบสคริปต์การโทรเชิงรุก (Proactive Call Script) สำหรับนายหน้าประกันภัยธนาคารกรุงศรี
เขียนสคริปต์การโทรที่ให้ความรู้สึกอบอุ่น เป็นที่ปรึกษา ไม่ยัดเยียดการขาย (Consultative Approach)
เวลาพูดไม่เกิน 1 นาที โดยแบ่งโครงสร้างเป็น 3 ขั้นตอน:
1. บทเปิดและแสดงความยินดี/ความห่วงใยตามบริบทชีวิต (Empathy & Rapport)
2. การชี้ให้เห็นสถานะแบตเตอรี่ความคุ้มครองที่ลดลง (Value Proposition)
3. การนำเสนอทางเลือกและขอนัดหมายเพื่อจัดสรรแผน (Call to Action)`;

  const prompt = `ลูกค้า: ${customer.name}, อายุ ${customer.age} ปี
เหตุการณ์ชีวิต: ${lifeEvents.map(e => e.title).join(', ') || 'ทบทวนสิทธิประโยชน์ประจำปี'}
คำขอจากลูกค้า (Warm Lead): ${warmLead ? warmLead.intent_details : 'ไม่มี'}
ระดับแบตเตอรี่: ${customer.battery_score}%`;

  const script = await callOllama(prompt, system);
  if (script) {
    return script.trim();
  }

  // Fallback
  return `**1. บทเปิด (Empathy & Rapport):**\n"สวัสดีครับคุณ${customer.name} ผมกิตติพงษ์ จากทีมที่ปรึกษาประกันภัยธนาคารกรุงศรีนะครับ ขอแสดงความยินดีด้วยอย่างยิ่งกับก้าวสำคัญของชีวิตในเรื่องสมาชิกใหม่ของครอบครัวนะครับ"\n\n**2. ชี้จุดช่องว่างความคุ้มครอง (Gap Analysis):**\n"จากระบบ Coverage Pulse ที่ช่วยดูแลความคุ้มครองให้สอดคล้องกับปัจจุบัน พบว่าสถานะแบตเตอรี่ความคุ้มครองเดิมของคุณลดลงเหลือ ${customer.battery_score}% เนื่องจากแผนเดิมเน้นการออมทรัพย์ แต่ยังไม่มีความคุ้มครองค่ารักษาพยาบาลสำหรับคุณแม่และสมาชิกตัวน้อยที่จะลืมตาดูโลกครับ"\n\n**3. ข้อเสนอแนะและการปิดนัดหมาย (Next Step):**\n"ผมขออนุญาตใช้เวลาสัก 5 นาที เพื่อส่งสรุปทางเลือกแผนเหมาจ่ายที่สอดคล้องกับงบประมาณให้คุณลองพิจารณา สะดวกให้ผมติดต่อกลับหรือส่งข้อมูลทาง Line Krungsri ช่วงบ่ายนี้ดีไหมครับ"`;
}

export default {
  chatWithCopilot,
  generateNextBestAction,
  generatePreCallScript
};
