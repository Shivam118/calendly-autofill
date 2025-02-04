const axios = require("axios");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const PORT = process.env.PORT;

const supabase = createClient(supabaseUrl, supabaseKey);

// Dummy function to fetch client data from DB based on username
async function getClientByUsername(username) {
  const { data, error } = await supabase
    .from("clients") // Assuming your table name is 'clients'
    .select("*")
    .eq("username", username)
    .single();

  if (error) {
    console.error("Error fetching client from Supabase:", error);
    return null;
  }

  return data;
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
    return response.data; // Assuming first match is correct
  } catch (error) {
    console.error("Error fetching SmartLead data:", error);
    return null;
  }
}

// Route to handle requests
app.get("/:username/:email", async (req, res) => {
  const { username, email } = req.params;

  // Fetch client details based on username
  const client = await getClientByUsername(username);
  if (!client) console.log("Client not found");

  // Fetch lead details from SmartLead API
  const leadData = await fetchLeadData(client.smartLeadApiKey, email);
  if (!leadData) console.log("Lead not found");

  const fullName = leadData.first_name + " " + leadData.last_name;
  const phone = leadData.phone_number;

  // Build Calendly URL with prefilled details
  const calendlyUrl = `${client.calendlyLink}?name=${encodeURIComponent(
    fullName
  )}&email=${encodeURIComponent(leadData.email)}&phone=${encodeURIComponent(
    phone
  )}`;

  // Redirect to Calendly
  res.redirect(calendlyUrl);
});

// Start server
app.listen(PORT || 5000, () => console.log(`Server running on port ${PORT}`));
