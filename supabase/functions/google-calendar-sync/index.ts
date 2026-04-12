import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const body = await req.json();
    const { action, visita } = body;

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Google not connected", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const event = buildEvent(visita);
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Google Calendar create error:", errText);
        return new Response(JSON.stringify({ error: "Failed to create event" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const created = await res.json();

      // Update visita with google_event_id
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await serviceClient
        .from("visitas_tecnicas")
        .update({ google_event_id: created.id })
        .eq("id", visita.id);

      return new Response(JSON.stringify({ success: true, eventId: created.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      if (!visita.google_event_id) {
        return new Response(JSON.stringify({ skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const event = buildEvent(visita);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${visita.google_event_id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (!res.ok) {
        console.error("Google Calendar update error:", await res.text());
      }

      return new Response(JSON.stringify({ success: res.ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!visita.google_event_id) {
        return new Response(JSON.stringify({ skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${visita.google_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      return new Response(JSON.stringify({ success: res.ok || res.status === 404 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildEvent(visita: any) {
  const date = visita.data || new Date().toISOString().split("T")[0];
  const hora = visita.hora || "09:00";
  const [h, m] = hora.split(":");
  const startDate = new Date(`${date}T${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}:00`);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours

  return {
    summary: `Visita Técnica${visita.projetoNome ? ` - ${visita.projetoNome}` : ""}`,
    description: [
      visita.descricao || "Visita técnica agendada",
      visita.clienteNome ? `Cliente: ${visita.clienteNome}` : "",
      visita.tecnicoNome ? `Técnico: ${visita.tecnicoNome}` : "",
    ].filter(Boolean).join("\n"),
    start: {
      dateTime: startDate.toISOString(),
      timeZone: "America/Sao_Paulo",
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: "America/Sao_Paulo",
    },
  };
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: integration } = await serviceClient
    .from("google_integrations")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!integration) return null;

  if (integration.expiry_date && new Date(integration.expiry_date) < new Date()) {
    if (!integration.refresh_token) return null;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        refresh_token: integration.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await res.json();
    if (tokenData.error) return null;

    const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    await serviceClient
      .from("google_integrations")
      .update({
        access_token: tokenData.access_token,
        expiry_date: newExpiry,
      })
      .eq("user_id", userId);

    return tokenData.access_token;
  }

  return integration.access_token;
}
