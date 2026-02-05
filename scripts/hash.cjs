// scripts/hash.cjs
const bcrypt = require('bcryptjs');

(async () => {
  const senha = '04121978'; 
  const hash = await bcrypt.hash(senha, 10);
  console.log('Senha:', senha);
  console.log('Hash:', hash);
})();
