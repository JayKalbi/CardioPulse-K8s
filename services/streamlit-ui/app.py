"""
CardioPulse Cloud-Native Clinical Dashboard (Tier 1 Streamlit Microservice)
Provides a rich interactive interface for single patient triage, batch CSV screening,
and Kubernetes cluster diagnostic health checks.
"""

import os
import requests
import pandas as pd
import streamlit as st
import plotly.graph_objects as go

# Set page configuration with medical dark/light styling
st.set_page_config(
    page_title="CardioPulse - Cardiovascular Risk Triage",
    page_icon="🫀",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for rich aesthetics
st.markdown("""
<style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        background: linear-gradient(90deg, #e63946, #d62828);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0px;
    }
    .sub-header {
        color: #6c757d;
        font-size: 1.05rem;
        margin-bottom: 25px;
    }
    .metric-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
</style>
""", unsafe_allow_html=True)

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://cardiopulse-gateway-svc:5000")

# Sidebar
st.sidebar.image("https://img.icons8.com/fluency/96/heart-with-pulse.png", width=70)
st.sidebar.title("CardioPulse K8s")
st.sidebar.caption("Cloud-Native Clinical Decision Support")
st.sidebar.markdown("---")
st.sidebar.info(f"**Gateway Endpoint:**\n`{GATEWAY_URL}`")

# Header
st.markdown('<p class="main-header">🫀 CardioPulse Clinical Triage Platform</p>', unsafe_allow_html=True)
st.markdown('<p class="sub-header">Multi-Tier Microservices Architecture on Kubernetes with Calibrated Machine Learning</p>', unsafe_allow_html=True)

tab1, tab2, tab3 = st.tabs(["🔬 Patient Triage Calculator", "📂 Batch Patient Screening", "☸️ Cluster Diagnostics"])

# ==========================================
# TAB 1: Single Patient Triage
# ==========================================
with tab1:
    st.subheader("Single Patient Assessment")
    st.write("Enter patient vitals and clinical examination findings:")

    col1, col2, col3 = st.columns(3)

    with col1:
        age = st.slider("Patient Age", 18, 100, 55)
        sex = st.selectbox("Sex", options=[("Male", 1), ("Female", 0)], format_func=lambda x: x[0])[1]
        cp = st.selectbox("Chest Pain Type", options=[
            ("Asymptomatic (Type 4)", 3),
            ("Non-Anginal Pain (Type 3)", 2),
            ("Atypical Angina (Type 2)", 1),
            ("Typical Angina (Type 1)", 0)
        ], format_func=lambda x: x[0])[1]
        trestbps = st.number_input("Resting Blood Pressure (mm Hg)", 80, 240, 130)

    with col2:
        chol = st.number_input("Serum Cholesterol (mg/dl)", 100, 600, 240)
        fbs = st.selectbox("Fasting Blood Sugar > 120 mg/dl", options=[("No (<= 120)", 0), ("Yes (> 120)", 1)], format_func=lambda x: x[0])[1]
        restecg = st.selectbox("Resting ECG Results", options=[
            ("Normal", 0),
            ("ST-T Wave Abnormality", 1),
            ("Left Ventricular Hypertrophy", 2)
        ], format_func=lambda x: x[0])[1]
        thalach = st.slider("Max Heart Rate Achieved (bpm)", 60, 220, 150)

    with col3:
        exang = st.selectbox("Exercise Induced Angina", options=[("No", 0), ("Yes", 1)], format_func=lambda x: x[0])[1]
        oldpeak = st.slider("ST Depression Induced by Exercise", 0.0, 6.5, 1.2, step=0.1)
        slope = st.selectbox("Slope of Peak Exercise ST", options=[
            ("Upsloping", 0), ("Flat", 1), ("Downsloping", 2)
        ], format_func=lambda x: x[0])[1]
        ca = st.selectbox("Major Vessels Colored by Fluoroscopy", [0, 1, 2, 3])
        thal = st.selectbox("Thalassemia", options=[("Normal", 1), ("Fixed Defect", 2), ("Reversible Defect", 3)], format_func=lambda x: x[0])[1]

    if st.button("🚀 Run Risk Assessment", type="primary", use_container_width=True):
        patient_payload = {
            "features": {
                "age": age, "sex": sex, "cp": cp, "trestbps": trestbps,
                "chol": chol, "fbs": fbs, "restecg": restecg, "thalach": thalach,
                "exang": exang, "oldpeak": oldpeak, "slope": slope, "ca": ca, "thal": thal
            }
        }

        with st.spinner("Dispatching payload through Kubernetes API Gateway..."):
            try:
                resp = requests.post(f"{GATEWAY_URL}/api/v1/triage", json=patient_payload, timeout=6)
                if resp.status_code == 200:
                    data = resp.json()
                    res = data["payload"]["results"]
                    risk_pct = res["risk_probability"]
                    cat = res["triage_category"]
                    advice = res["clinical_recommendation"]

                    st.markdown("---")
                    res_col1, res_col2 = st.columns([1, 1])

                    with res_col1:
                        # Gauge Chart
                        fig = go.Figure(go.Indicator(
                            mode="gauge+number",
                            value=risk_pct,
                            number={'suffix': "%"},
                            title={'text': f"Cardiovascular Risk: {cat}"},
                            gauge={
                                'axis': {'range': [0, 100]},
                                'bar': {'color': "#d62828" if risk_pct >= 65 else ("#f77f00" if risk_pct >= 35 else "#2a9d8f")},
                                'steps': [
                                    {'range': [0, 35], 'color': "rgba(42, 157, 143, 0.2)"},
                                    {'range': [35, 65], 'color': "rgba(247, 127, 0, 0.2)"},
                                    {'range': [65, 100], 'color': "rgba(214, 40, 40, 0.2)"}
                                ],
                                'threshold': {
                                    'line': {'color': "red", 'width': 4},
                                    'thickness': 0.75,
                                    'value': 65
                                }
                            }
                        ))
                        fig.update_layout(height=300, margin=dict(l=10, r=10, t=40, b=10))
                        st.plotly_chart(fig, use_container_width=True)

                    with res_col2:
                        st.markdown(f"### Diagnostic Summary")
                        if cat == "High Risk":
                            st.error(f"⚠️ **Critical Risk Alert**: {risk_pct}% Probability")
                        elif cat == "Moderate Risk":
                            st.warning(f"⚡ **Moderate Risk**: {risk_pct}% Probability")
                        else:
                            st.success(f"✅ **Low Risk**: {risk_pct}% Probability")

                        st.info(f"**Clinical Next Step:**\n\n{advice}")
                        st.caption(f"Routed through microservice tier: `{data.get('routed_via')}`")

                else:
                    st.error(f"Error from Gateway ({resp.status_code}): {resp.text}")
            except Exception as e:
                st.error(f"Failed to communicate with Gateway at `{GATEWAY_URL}`: {e}")

# ==========================================
# TAB 2: Batch Patient Screening
# ==========================================
with tab2:
    st.subheader("Batch Patient Screening via CSV")
    st.write("Upload a CSV file containing patient records to evaluate an entire ward or cohort:")

    sample_csv_download = pd.DataFrame([
        {"age": 63, "sex": 1, "cp": 1, "trestbps": 145, "chol": 233, "fbs": 1, "restecg": 2, "thalach": 150, "exang": 0, "oldpeak": 2.3, "slope": 3, "ca": 0, "thal": 6},
        {"age": 67, "sex": 1, "cp": 4, "trestbps": 160, "chol": 286, "fbs": 0, "restecg": 2, "thalach": 108, "exang": 1, "oldpeak": 1.5, "slope": 2, "ca": 3, "thal": 3},
        {"age": 41, "sex": 0, "cp": 2, "trestbps": 130, "chol": 204, "fbs": 0, "restecg": 2, "thalach": 172, "exang": 0, "oldpeak": 1.4, "slope": 1, "ca": 0, "thal": 3}
    ])
    st.download_button("📥 Download Sample Template CSV", data=sample_csv_download.to_csv(index=False), file_name="sample_patients.csv", mime="text/csv")

    uploaded_file = st.file_uploader("Upload Patients CSV", type=["csv"])
    if uploaded_file is not None:
        batch_df = pd.read_csv(uploaded_file)
        st.write("Uploaded Patient Batch Preview:", batch_df.head())

        if st.button("⚡ Score Patient Cohort", type="primary"):
            with st.spinner("Processing batch via Kubernetes cluster..."):
                try:
                    payload = {"patients": batch_df.to_dict(orient="records")}
                    resp = requests.post(f"{GATEWAY_URL}/api/v1/triage", json=payload, timeout=12)
                    if resp.status_code == 200:
                        batch_res = resp.json()["payload"]["results"]
                        res_df = pd.DataFrame(batch_res)
                        merged = pd.concat([batch_df.reset_index(drop=True), res_df], axis=1)

                        st.success(f"Successfully evaluated {len(batch_res)} patients!")
                        st.dataframe(merged.style.highlight_max(subset=["risk_probability"], color="#f8d7da"))
                    else:
                        st.error(f"Batch processing error: {resp.text}")
                except Exception as e:
                    st.error(f"Request failed: {e}")

# ==========================================
# TAB 3: Cluster Diagnostics
# ==========================================
with tab3:
    st.subheader("Kubernetes Microservices Topology & Health")
    if st.button("🔄 Refresh Cluster Status"):
        try:
            resp = requests.get(f"{GATEWAY_URL}/healthz", timeout=4)
            if resp.status_code == 200:
                health = resp.json()
                st.success("✅ Gateway Microservice: Online")
                st.json(health)
            else:
                st.warning(f"Gateway returned status {resp.status_code}")
        except Exception as e:
            st.error(f"Gateway offline or unreachable: {e}")
