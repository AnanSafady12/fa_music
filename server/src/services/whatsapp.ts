import twilio from 'twilio'

export async function sendLessonReminder(studentName: string, instrument: string, startTime: string, toPhone: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER

  // Standardize number (ensure it has international code without spaces)
  let cleanPhone = toPhone.replace(/\D/g, '') // remove all non-digits
  
  // If it's a local Israeli number starting with 05..., prepend +972 (removing the leading 0)
  if (cleanPhone.startsWith('05') && cleanPhone.length === 10) {
    cleanPhone = '972' + cleanPhone.substring(1)
  }
  
  // Prepend '+' if not present
  const formattedTo = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`
  
  // The message body text. Note: For production, this must match your approved WhatsApp template format in Twilio.
  const body = `Reminder: Hello ${studentName}, you have a ${instrument} lesson today starting at ${startTime}.`

  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[WhatsApp Mock] [${new Date().toISOString()}] To: whatsapp:${formattedTo} | Body: "${body}"`)
    return { success: true, mock: true }
  }

  try {
    const client = twilio(accountSid, authToken)
    const message = await client.messages.create({
      from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
      to: `whatsapp:${formattedTo}`,
      body: body
    })
    console.log(`[WhatsApp API] [${new Date().toISOString()}] Message sent to ${formattedTo}. SID: ${message.sid}`)
    return { success: true, sid: message.sid }
  } catch (err) {
    console.error(`[WhatsApp API] [${new Date().toISOString()}] Error sending message to ${formattedTo}:`, err)
    throw err
  }
}
