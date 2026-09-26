// === CONFIGURAÇÃO DO SUPABASE ===
const SUPABASE_URL = "https://doecoosuqibzdsyadsyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_-30z4xAhwJPYmy1bfSEjCw_loKUe8uL";

const _supabase = supabase.Client ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let selectedBarber = "Equipe 1";
let selectedServices = []; 
let requisicaoHorariosAtual = 0;

// Duração dos serviços de lava jato em minutos
const duracoesServicos = {
    "Lavagem Simples": 40,
    "Lavagem Completa": 60,
    "Ducha": 20,
    "Aspiração": 30,
    "Higienização de Bancos": 120,
    "Polimento de Faróis": 40
};

document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("date");
    if (dateInput) {
        const todayObj = new Date();
        const todayStr = todayObj.toISOString().split("T")[0];
        
        dateInput.min = todayStr;
        const maxDateObj = new Date();
        maxDateObj.setDate(todayObj.getDate() + 21);
        dateInput.max = maxDateObj.toISOString().split("T")[0];

        dateInput.value = todayStr;
    }
    checkAvailableTimes();
});

function selectBarber(element, barberName) {
    document.querySelectorAll(".barber-card").forEach(card => card.classList.remove("active"));
    element.classList.add("active");
    selectedBarber = barberName;
    checkAvailableTimes();
}

function toggleService(element, serviceName, price) {
    const icon = element.querySelector(".checkbox-icon");
    const index = selectedServices.findIndex(s => s.name === serviceName);
    const duration = duracoesServicos[serviceName] || 30;

    if (index > -1) {
        selectedServices.splice(index, 1);
        element.classList.remove("active");
        if (icon) {
            icon.classList.remove("fa-solid", "fa-square-check");
            icon.classList.add("fa-regular", "fa-square");
        }
    } else {
        selectedServices.push({ name: serviceName, price: price, duration: duration });
        element.classList.add("active");
        if (icon) {
            icon.classList.remove("fa-regular", "fa-square");
            icon.classList.add("fa-solid", "fa-square-check");
        }
    }
    
    checkAvailableTimes();
}

function getTimesForDate(dateString) {
    if (!dateString) return [];
    
    const partes = dateString.split('-');
    const dataObj = new Date(partes[0], partes[1] - 1, partes[2]);
    const diaSemana = dataObj.getDay(); 

    let horarios = [];

    if (diaSemana === 0) { 
        return [];
    } else { 
        for (let h = 8; h < 18; h++) {
            horarios.push(h < 10 ? `0${h}:00` : `${h}:00`);
            horarios.push(h < 10 ? `0${h}:30` : `${h}:30`);
        }
        horarios.push("18:00");
    }

    const agora = new Date();
    const hojeStr = agora.toISOString().split("T")[0];
    if (dateString === hojeStr) {
        const limite = new Date(agora.getTime() + 30 * 60000);
        const horaLimite = `${String(limite.getHours()).padStart(2, "0")}:${String(limite.getMinutes()).padStart(2, "0")}`;
        horarios = horarios.filter(h => h >= horaLimite);
    }

    return horarios;
}

async function checkAvailableTimes() {
    const minhaRequisicao = ++requisicaoHorariosAtual;
    const dateElement = document.getElementById("date");
    const timeSelect = document.getElementById("time");

    if (!dateElement || !timeSelect) return;

    const selectedDate = dateElement.value;
    if (!selectedDate) return;

    const allTimes = getTimesForDate(selectedDate);
    timeSelect.innerHTML = "";

    if (allTimes.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Fechado neste dia";
        option.disabled = true;
        timeSelect.appendChild(option);
        return;
    }

    const totalDurationMinutes = selectedServices.reduce((acc, s) => acc + s.duration, 0) || 30;
    const slotsNeeded = Math.ceil(totalDurationMinutes / 30);

    const optionCarregando = document.createElement("option");
    optionCarregando.value = "";
    optionCarregando.textContent = "Carregando horários...";
    optionCarregando.disabled = true;
    timeSelect.appendChild(optionCarregando);

    try {
        const { data: agendamentos, error: errAgendamentos } = await _supabase
            .from("agendamentos_lavajato")
            .select("horario, status, servico")
            .eq("barbeiro", selectedBarber)
            .eq("data", selectedDate);

        if (errAgendamentos) throw errAgendamentos;
        if (minhaRequisicao !== requisicaoHorariosAtual) return;

        let occupiedTimes = [];
        if (agendamentos) {
            agendamentos.filter(a => a.status !== 'cancelado').forEach(a => {
                occupiedTimes.push(a.horario);
            });
        }

        timeSelect.innerHTML = "";

        allTimes.forEach((time, index) => {
            const option = document.createElement("option");
            option.value = time;

            let temConflito = false;
            if (index + slotsNeeded > allTimes.length) {
                temConflito = true;
            } else {
                for (let i = 0; i < slotsNeeded; i++) {
                    if (occupiedTimes.includes(allTimes[index + i])) {
                        temConflito = true;
                        break;
                    }
                }
            }

            if (temConflito) {
                option.textContent = `${time} - (Indisponível)`;
                option.disabled = true;
            } else {
                option.textContent = time;
            }
            timeSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Erro ao buscar disponibilidade:", err);
    }
}

async function buscarClientePorTelefone() {
    const telefoneInput = document.getElementById("client-phone").value.trim();
    if (!telefoneInput) return;

    const telefoneLimpo = telefoneInput.replace(/\D/g, '');
    if (telefoneLimpo.length < 8) return;

    try {
        const { data, error } = await _supabase
            .from("agendamentos_lavajato")
            .select("cliente, telefone, carro");

        if (error) throw error;

        if (data && data.length > 0) {
            const registro = data.find(item => item.telefone && item.telefone.replace(/\D/g, '') === telefoneLimpo);
            if (registro) {
                if (registro.cliente) document.getElementById("client-name").value = registro.cliente;
                if (registro.carro && document.getElementById("car-model")) {
                    document.getElementById("car-model").value = registro.carro;
                }
            }
        }
    } catch (err) {
        console.error("Erro ao buscar cliente:", err);
    }
}

function abrirModalConfirmacao() {
    const nameInput = document.getElementById("client-name");
    const phoneInput = document.getElementById("client-phone");
    const carInput = document.getElementById("car-model");
    const dateInput = document.getElementById("date");
    const timeSelect = document.getElementById("time");

    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const car = carInput ? carInput.value.trim() : "";
    const date = dateInput ? dateInput.value : "";
    const time = timeSelect ? timeSelect.value : "";

    if (!name || !phone || !car) {
        alert("Por favor, preencha o nome, WhatsApp e o modelo do carro antes de prosseguir.");
        return;
    }

    if (selectedServices.length === 0) {
        alert("Por favor, selecione pelo menos um serviço.");
        return;
    }

    if (!time || timeSelect.selectedOptions[0]?.disabled) {
        alert("Por favor, selecione um horário válido e disponível.");
        return;
    }

    let precoTotal = 0;
    const servicosNomes = selectedServices.map(s => {
        precoTotal += s.price;
        return s.name;
    });

    const formattedDate = date.split("-").reverse().join("/");

    const resumoDiv = document.getElementById("resumo-agendamento");
    if (resumoDiv) {
        resumoDiv.innerHTML = `
            <div style="margin-bottom: 6px;"><strong>Veículo:</strong> ${car}</div>
            <div style="margin-bottom: 6px;"><strong>Data:</strong> ${formattedDate} às ${time}</div>
            <div style="margin-bottom: 6px;"><strong>Serviços:</strong> ${servicosNomes.join(", ")}</div>
            <div style="margin-top: 10px; border-top: 1px solid #EAEAEA; padding-top: 6px; font-size: 1.05rem;">
                <strong>Total:</strong> <span style="color: #25D366; font-weight: bold;">R$ ${precoTotal.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
    }

    const modal = document.getElementById("modal-confirmacao");
    if (modal) modal.style.display = "flex";
}

function fecharModalConfirmacao() {
    const modal = document.getElementById("modal-confirmacao");
    if (modal) modal.style.display = "none";
}

async function confirmarEEnviar() {
    fecharModalConfirmacao();
    
    const name = document.getElementById("client-name").value.trim();
    const phone = document.getElementById("client-phone").value.trim();
    const car = document.getElementById("car-model").value.trim();
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;

    let precoTotal = 0;
    let listaNomesServicos = selectedServices.map(s => {
        precoTotal += s.price;
        return s.name;
    }).join(", ");

    const formattedDate = date.split("-").reverse().join("/");
    const whatsappNumber = "5531994951564"; 

    const message = `✅ *AGENDAMENTO DE LAVAGEM* ✅\n\n👤 *Cliente:* ${name}\n📱 *Telefone:* ${phone}\n🚗 *Veículo:* ${car}\n🧼 *Serviços:* ${listaNomesServicos} (Total: R$ ${precoTotal},00)\n📅 *Data:* ${formattedDate}\n⏰ *Horário:* ${time}`;

    const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    try {
        const { error } = await _supabase.from("agendamentos_lavajato").insert([
            {
                cliente: name,
                telefone: phone,
                carro: car,
                barbeiro: selectedBarber,
                servico: listaNomesServicos,
                preco_total: precoTotal,
                data: date,
                horario: time,
                status: 'ativo'
            }
        ]);

        if (error) {
            console.error("Erro ao gravar no Supabase:", error);
            alert("Houve um erro ao salvar no banco de dados, mas o WhatsApp será aberto.");
        }
    } catch (err) {
        console.error("Erro na requisição:", err);
    }

    window.location.href = link;
}
