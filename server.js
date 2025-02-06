const axios = require("axios");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const PORT = process.env.PORT;
const DOMAIN = process.env.DOMAIN;

const supabase = createClient(supabaseUrl, supabaseKey);

// Dummy function to fetch client data from DB based on username
async function getClientByDomainOrUsername({ domain, username, isDomain }) {
  let clientData;
  if (isDomain) {
    const { data, error } = await supabase
      .from("clients") // Assuming your table name is 'clients'
      .select("*")
      .eq("domain", domain)
      .single();
    clientData = data;
    if (error) {
      console.error("Error fetching client from Supabase:", error);
      return null;
    }
  } else {
    const { data, error } = await supabase
      .from("clients") // Assuming your table name is 'clients'
      .select("*")
      .eq("username", username)
      .single();
    clientData = data;
    if (error) {
      console.error("Error fetching client from Supabase:", error);
      return null;
    }
  }

  return clientData;
}

// Dummy function to fetch lead details from SmartLead API
async function fetchLeadData(apiKey, email) {
  if (apiKey === "ABCD") {
    // Dummy API key
    return {
      name: "SHIVAM WIN",
      email: "sharmashivam@gmail.com",
    };
  }
  try {
    const response = await axios.get(
      `https://server.smartlead.ai/api/v1/leads/?api_key=${apiKey}&email=${email}`
    );
    return response?.data; // Assuming first match is correct
  } catch (error) {
    console.error("Error fetching SmartLead data:", error);
    return null;
  }
}

async function isValidSmartLeadApiKey(apiKey, email) {
  try {
    const response = await axios.get(
      `https://server.smartlead.ai/api/v1/leads/?api_key=${apiKey}&email=${email}`
    );
    console.log("SmartLead Response:", response.data);
    return response?.status === 200;
  } catch (error) {
    if (error?.response) {
      // API responded with an error status (e.g., 401 Unauthorized)
      console.error(
        "SmartLead API Error:",
        error?.response?.status,
        error?.response?.data
      );
    } else if (error?.request) {
      // No response was received (network issue, server down, etc.)
      console.error("No response from SmartLead API:", error?.request);
    } else {
      // Other errors (e.g., invalid request)
      console.error("Request Error:", error?.message);
    }
    return false;
  }
}

app.get("/", (req, res) => { 
  try {
    res.send("Webhook is running...");
  } catch (error) {
    console.error("Error in request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to handle requests
app.get("/:param1/:param2", async (req, res) => {
  try {
    console.log("--------- Request received:", req);
    const { param1, param2 } = req?.params;
    let clientDomain = req?.hostname; // Gets the domain from request

    let username, email, client, fullName, phone, leadData;
    if (clientDomain !== DOMAIN) {
      // Custom domain case: Find client by domain
      email = param1;
      client = await getClientByDomainOrUsername({
        domain: clientDomain,
        isDomain: true,
      });
    } else {
      // Default webhook case: Find client by username in URL
      username = param1;
      email = param2;
      client = await getClientByDomainOrUsername({ username, isDomain: false });
    }
    if (client) {
      // Fetch lead details from SmartLead API
      leadData = await fetchLeadData(client?.smartLeadApiKey, email);
      if (leadData) {
        fullName = leadData?.first_name + " " + leadData?.last_name;
        phone = leadData?.phone_number;
      } else {
        console.log("Lead not found");
      }
    } else {
      console.log("Client not found");
    }

    // Build Calendly URL with prefilled details
    const calendlyUrl = `${client?.calendlyLink}?name=${encodeURIComponent(
      fullName
    )}&email=${encodeURIComponent(leadData?.email)}&phone=${encodeURIComponent(
      phone
    )}`;

    // Redirect to Calendly
    res?.redirect(calendlyUrl);
  } catch (error) {
    console.error("Error in request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Create client
 */
app.post("/client", async (req, res) => {
  try {
    const { username, calendlyLink, email, smartLeadApiKey, domain } =
      req?.body;

    if (!smartLeadApiKey || !calendlyLink || !email) {
      return res.status(400).json({
        error: "Missing required fields [Smart Lead API/ Calendly Link/ Email]",
      });
    }

    const isValidKey = await isValidSmartLeadApiKey(smartLeadApiKey, email);

    if (isValidKey === false) {
      return res.status(400).json({
        error: "Invalid Smart Lead API Key",
      });
    }

    const { data, error } = await supabase
      .from("clients")
      .insert([{ username, calendlyLink, email, smartLeadApiKey, domain }]);

    if (error) {
      return res.status(500).json({ error: "Error creating client" });
    }

    res.status(201).json({ message: "Client created successfully", data });
  } catch (error) {
    console.error("Error in request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Update a client
 */
app.put("/client", async (req, res) => {
  try {
    const { username, calendlyLink, email, smartLeadApiKey, domain } =
      req?.body;

    if (!smartLeadApiKey || !calendlyLink || !email) {
      return res.status(400).json({
        error: "Missing required fields [Smart Lead API/ Calendly Link/ Email]",
      });
    }
    const isValidKey = await isValidSmartLeadApiKey(smartLeadApiKey, email);

    if (isValidKey === false) {
      return res.status(400).json({
        error: "Invalid Smart Lead API Key",
      });
    }

    const { data, error } = await supabase
      .from("clients")
      .update({ username, calendlyLink, smartLeadApiKey, domain })
      .eq("email", email);

    if (error) {
      return res.status(500).json({ error: "Error updating client" });
    }

    res.json({ message: "Client updated successfully", data });
  } catch (error) {
    console.error("Error in request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Delete a client
 */
app.delete("/client/:email", async (req, res) => {
  try {
    const { email } = req?.params;
    const { data, error } = await supabase
      .from("clients")
      .delete()
      .eq("email", email);

    if (error) {
      return res.status(500).json({ error: "Error deleting client" });
    }

    res.json({ message: "Client deleted successfully" });
  } catch (error) {
    console.error("Error in request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
app.listen(PORT || 5000, () => console.log(`Server running on port ${PORT}`));
