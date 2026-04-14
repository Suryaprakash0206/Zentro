import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@zentro.com';

serve(async (req) => {
  try {
    const payload = await req.json();
    const booking = payload.record;

    // Verify it is a valid booking update payload indicating completion
    if (payload.type !== 'UPDATE' || booking.status !== 'completed') {
      return new Response(JSON.stringify({ message: "Not a completion event, ignored" }), { status: 200 });
    }

    const { service_label, price, notes, location } = booking;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "Zentro Notifications <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `✅ Task Completed: ${service_label}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #22c55e;">A Task Has Been Completed!</h2>
            <p>A worker has successfully finished a job and marked it as completed.</p>
            <hr />
            <p><strong>Service:</strong> ${service_label}</p>
            <p><strong>Price:</strong> ₹${price}</p>
            <p><strong>Location:</strong> ${location}</p>
            <p><strong>Notes:</strong> ${notes || "None"}</p>
            <br/>
            <p>Log in to your Zentro Admin Portal to view complete details.</p>
          </div>
        `
      })
    });

    const data = await emailResponse.json();

    return new Response(JSON.stringify({ success: true, email: data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Edge Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
})
