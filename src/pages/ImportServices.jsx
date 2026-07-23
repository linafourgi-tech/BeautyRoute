import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

export default function ImportServices() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);

    const { data, error } = await supabase
      .from("service_templates")
      .select("*")
      .order("category")
      .order("display_order");

    console.log("DATA:", data);
    console.log("ERROR:", error);

    if (error) {
      console.error(error);
    } else {
      setTemplates(data);
    }

    setLoading(false);
  }

  return (
    <Layout
      title="Import Services"
      subtitle="Choose the services you offer."
    >
      {loading ? (
        <p>Loading...</p>
      ) : (
        <pre>{JSON.stringify(templates, null, 2)}</pre>
      )}
    </Layout>
  );
}