document.getElementById("login-Form").addEventListener("submit", async (event) => {
  event.preventDefault();

    const usuario = document.getElementById("usuarioInput").value.trim();
    const senha = document.getElementById("senhaInput").value.trim();
    const mensagemErro = document.getElementById("mensagemErroLogin");

    mensagemErro.style.display = "none";

    try {
        const resposta = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ usuario, senha })
        });

        const dados = await resposta.json();
        // Redirecionar ou atualizar a interface conforme necessário
        if(resposta.ok){
            window.location.href = "/index.html";
        } else {
            mensagemErro.textContent = dados.erros ? dados.erros.join(", ") : "Erro ao fazer login.";
            mensagemErro.style.display = "block";
        }
        
    } catch (error) {
        mensagemErro.textContent = "Credenciais inválidas";
        mensagemErro.style.display = "block";
    }
});
