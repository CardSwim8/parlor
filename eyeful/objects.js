/* Eyeful scene objects: an emoji and the names players might write for it, "|" between names.
   The emoji artwork comes from the device's own emoji font; the names are ours. A scene counts an
   object for a letter if any of its names starts with that letter. */
var OBJECTS = [
  // animals
  "🐶 dog|puppy", "🐱 cat|kitten", "🐭 mouse", "🐹 hamster", "🐰 rabbit|bunny", "🦊 fox", "🐻 bear", "🐼 panda",
  "🐨 koala", "🐯 tiger", "🦁 lion", "🐮 cow", "🐷 pig", "🐸 frog|toad", "🐵 monkey", "🐔 chicken|hen", "🐧 penguin",
  "🐦 bird", "🐤 chick", "🦆 duck", "🦅 eagle", "🦉 owl", "🦇 bat", "🐺 wolf", "🐗 boar", "🐴 horse|pony",
  "🦄 unicorn", "🐝 bee|bumblebee", "🐛 caterpillar|bug", "🦋 butterfly", "🐌 snail", "🐞 ladybug|ladybird|beetle",
  "🐜 ant", "🕷️ spider", "🦂 scorpion", "🐢 turtle|tortoise", "🐍 snake|serpent", "🦎 lizard|gecko", "🦖 dinosaur|t-rex",
  "🐙 octopus", "🦑 squid", "🦐 shrimp|prawn", "🦀 crab", "🐡 pufferfish|blowfish", "🐠 fish|tropical fish",
  "🐬 dolphin", "🐳 whale", "🦈 shark", "🐊 crocodile|alligator", "🦓 zebra", "🦍 gorilla|ape", "🐘 elephant",
  "🦛 hippo|hippopotamus", "🦏 rhino|rhinoceros", "🐪 camel", "🦒 giraffe", "🦘 kangaroo", "🐑 sheep|lamb",
  "🐐 goat", "🦌 deer|reindeer", "🐓 rooster|cockerel", "🦃 turkey", "🦚 peacock", "🦜 parrot", "🦢 swan",
  "🦩 flamingo", "🦔 hedgehog", "🦦 otter", "🦥 sloth", "🐿️ squirrel|chipmunk", "🦨 skunk", "🦡 badger",
  "🐉 dragon", "🦭 seal", "🦫 beaver", "🦬 bison|buffalo", "🦣 mammoth", "🦗 cricket|grasshopper", "🪱 worm",
  "🦟 mosquito", "🦞 lobster", "🦪 oyster", "🐚 shell|seashell", "🦙 llama|alpaca", "🐇 hare", "🦤 dodo",
  // plants and nature
  "🌵 cactus", "🌲 tree|pine", "🌴 palm tree|palm", "🍀 clover|shamrock", "🍁 leaf|maple leaf", "🍄 mushroom|toadstool",
  "🌻 sunflower|flower", "🌹 rose", "🌷 tulip", "🌼 daisy", "🌸 blossom|cherry blossom", "🌾 wheat|grain",
  "🪴 plant|pot plant", "🌰 chestnut|acorn", "🪵 log|wood", "🌋 volcano", "🏔️ mountain", "🏝️ island",
  "🌈 rainbow", "☀️ sun", "🌙 moon", "⭐ star", "☁️ cloud", "⚡ lightning|bolt", "❄️ snowflake", "🔥 fire|flame",
  "💧 drop|droplet|water", "🌊 wave", "🌍 globe|earth|world", "🪐 planet|saturn", "☄️ comet", "🪨 rock|stone",
  // food and drink
  "🍎 apple", "🍐 pear", "🍊 orange|tangerine", "🍋 lemon", "🍌 banana", "🍉 watermelon|melon", "🍇 grapes",
  "🍓 strawberry|berry", "🍒 cherries|cherry", "🍑 peach", "🥭 mango", "🍍 pineapple", "🥥 coconut", "🥝 kiwi",
  "🍅 tomato", "🍆 eggplant|aubergine", "🥑 avocado", "🥦 broccoli", "🥕 carrot", "🌽 corn|sweetcorn",
  "🌶️ chili|pepper", "🥒 cucumber|pickle", "🧄 garlic", "🧅 onion", "🥔 potato", "🥐 croissant", "🥖 baguette|bread",
  "🥨 pretzel", "🧀 cheese", "🥚 egg", "🍳 frying pan|pan", "🥞 pancakes", "🧇 waffle", "🥓 bacon",
  "🍗 drumstick|chicken leg", "🍔 hamburger|burger", "🍟 fries|chips", "🍕 pizza", "🌭 hot dog|sausage",
  "🥪 sandwich", "🌮 taco", "🌯 burrito|wrap", "🥗 salad", "🍿 popcorn", "🍩 doughnut|donut", "🍪 cookie|biscuit",
  "🎂 birthday cake|cake", "🧁 cupcake|muffin", "🍫 chocolate|bar", "🍬 candy|sweet", "🍭 lollipop", "🍦 ice cream|cone",
  "🍯 honey|honey pot", "🥛 milk|glass", "☕ coffee|cup|mug", "🍵 tea", "🧃 juice box|juice", "🍼 baby bottle|bottle",
  "🍣 sushi", "🍙 rice ball", "🥟 dumpling", "🍜 noodles|ramen|bowl", "🥜 peanuts|nuts", "🧂 salt", "🥫 can|tin",
  "🫖 teapot", "🍴 fork|knife|cutlery", "🥄 spoon", "🥢 chopsticks", "🧊 ice cube|ice", "🥨 pretzel",
  // play and sport
  "⚽ soccer ball|football|ball", "🏀 basketball", "🏈 football|rugby ball", "⚾ baseball", "🎾 tennis ball",
  "🏐 volleyball", "🎱 pool ball|eight ball|billiards", "🏓 ping pong|paddle|bat", "🏸 badminton|shuttlecock",
  "🥊 boxing glove|glove", "🛹 skateboard", "🛼 roller skate|skate", "⛸️ ice skate|skate", "🎿 skis", "🛷 sled|sledge",
  "🪁 kite", "🎣 fishing rod|rod", "🎯 dartboard|target|bullseye|dart", "🎮 controller|game", "🎲 dice|die",
  "🧩 jigsaw|puzzle", "🧸 teddy bear|teddy", "🪀 yo-yo", "🎈 balloon", "🎁 gift|present", "🎀 ribbon|bow",
  "🎉 party popper", "🪅 piñata|pinata", "🏆 trophy|cup", "🥇 medal|gold medal", "🎫 ticket", "🪩 disco ball|mirror ball",
  "🎠 carousel|merry-go-round", "🎡 ferris wheel|wheel", "🎢 roller coaster|coaster", "🃏 joker|card", "♟️ chess|pawn",
  // around the house
  "🎨 palette|paint", "🖌️ paintbrush|brush", "🖍️ crayon", "✏️ pencil", "🖊️ pen", "📏 ruler", "📐 set square|triangle",
  "✂️ scissors", "📎 paperclip|clip", "📌 pushpin|pin", "📚 books|book", "📓 notebook", "✉️ envelope|letter|mail",
  "📦 package|parcel|box", "🔑 key", "🔒 padlock|lock", "🔨 hammer", "🪓 axe", "🔧 wrench|spanner", "🪛 screwdriver",
  "🔩 bolt|nut|screw", "⚙️ gear|cog", "🧲 magnet", "🧰 toolbox", "🪜 ladder", "🧱 bricks|brick|wall", "🪣 bucket|pail",
  "🧹 broom", "🧺 basket", "🧻 toilet paper|paper", "🧼 soap", "🪥 toothbrush", "🧽 sponge", "🛁 bathtub|bath|tub",
  "🚿 shower", "🚽 toilet", "🛏️ bed", "🛋️ sofa|couch", "🪑 chair", "🚪 door", "🪟 window", "🪞 mirror",
  "🕯️ candle", "💡 light bulb|bulb|lamp", "🔦 flashlight|torch", "🧯 fire extinguisher|extinguisher",
  "🛒 shopping cart|cart|trolley", "⏰ alarm clock|clock", "⌛ hourglass|sand timer", "⏱️ stopwatch|timer",
  "🧭 compass", "☂️ umbrella", "🧴 lotion|bottle", "🏺 vase|jar|urn", "🪤 mousetrap|trap", "🧷 safety pin|pin",
  "🧵 thread|spool|reel", "🧶 yarn|wool", "🪡 needle", "🛎️ bell|service bell", "🔔 bell", "📮 postbox|mailbox",
  "🗑️ bin|trash can|wastebasket", "🧸 teddy bear|teddy",
  // things to wear
  "👓 glasses|spectacles", "🕶️ sunglasses|shades", "👑 crown", "🎩 top hat|hat", "🧢 cap|baseball cap", "👒 sun hat|hat",
  "⛑️ helmet", "🎓 mortarboard|graduation cap", "👟 sneaker|trainer|shoe", "👠 high heel|shoe", "👢 boot",
  "🧦 socks", "🧤 gloves|mittens", "🧣 scarf", "👕 t-shirt|shirt|top", "👖 jeans|trousers|pants", "👗 dress",
  "🩳 shorts", "👜 handbag|purse|bag", "🎒 backpack|rucksack|bag", "💍 ring", "💎 diamond|gem|jewel",
  "💰 money bag|sack", "💵 banknote|money|dollar", "🪙 coin", "💳 credit card|card", "👔 tie|necktie",
  // gadgets and music
  "📱 phone|mobile", "💻 laptop|computer", "⌨️ keyboard", "🖱️ mouse", "🖨️ printer", "📷 camera", "🎥 movie camera|camera",
  "📺 television|tv", "📻 radio", "☎️ telephone|phone", "🔋 battery", "🔌 plug", "💾 floppy disk|disk", "💿 cd|disc",
  "🎧 headphones", "🎤 microphone|mic", "🎸 guitar", "🎹 piano|keyboard", "🎺 trumpet", "🎻 violin|fiddle",
  "🥁 drum", "🎷 saxophone|sax", "🪗 accordion", "📯 horn", "🔭 telescope", "🔬 microscope", "🧪 test tube",
  "💊 pill|tablet|medicine", "🩹 bandage|plaster", "🩺 stethoscope", "💉 syringe|needle", "🧮 abacus", "🎵 note|music",
  // adventure
  "🗡️ dagger|knife|sword", "⚔️ swords", "🛡️ shield", "🏹 bow and arrow|bow|arrow", "🪃 boomerang",
  "🔮 crystal ball|ball", "🪄 wand|magic wand", "🎭 masks|theater", "🎃 pumpkin|jack-o'-lantern",
  "🎄 christmas tree|tree", "🎆 fireworks", "⛄ snowman", "🧨 firecracker|dynamite", "🗺️ map", "🧳 suitcase|luggage",
  "⛺ tent", "🏠 house|home", "🏰 castle", "🏭 factory", "🗼 tower", "🗽 statue", "⛲ fountain", "⚓ anchor",
  "💣 bomb", "🏁 checkered flag|flag", "🚩 flag", "🪧 sign|placard", "💬 speech bubble|bubble", "🧱 wall",
  // getting around
  "🚗 car", "🚕 taxi|cab", "🚌 bus", "🚑 ambulance", "🚒 fire engine|fire truck", "🚓 police car", "🚜 tractor",
  "🏎️ racing car|race car", "🏍️ motorcycle|motorbike", "🚲 bicycle|bike", "🛴 scooter", "🚂 train|locomotive|engine",
  "🚁 helicopter", "✈️ airplane|plane|aeroplane", "🚀 rocket", "🛸 ufo|flying saucer|saucer", "⛵ sailboat|boat|yacht",
  "🚤 speedboat|boat", "🛶 canoe|kayak", "🚦 traffic light|lights", "🚧 roadworks|barrier", "🛞 wheel|tire|tyre",
  "⛽ fuel pump|gas pump", "🚠 cable car", "🛺 rickshaw", "🛵 moped",
  // characters and body
  "🤖 robot", "👻 ghost", "👽 alien", "💀 skull", "🤡 clown", "👀 eyes", "👃 nose", "👂 ear", "👄 lips|mouth",
  "🦷 tooth", "🦴 bone", "🧠 brain", "👣 footprints", "✋ hand", "👍 thumbs up|thumb", "💪 muscle|arm|bicep",
  "🦶 foot", "🦵 leg", "❤️ heart", "🎅 santa", "🧙 wizard", "🧜 mermaid", "🧛 vampire", "🧚 fairy", "🥷 ninja",
  "👸 princess", "🤴 prince", "🦸 superhero|hero", "🧞 genie", "🧟 zombie"
].map(function(s){
  var sp = s.indexOf(" ");
  return { e: s.slice(0, sp), names: s.slice(sp + 1).split("|") };
}).filter(function(o, i, all){ // drop accidental repeats of the same emoji
  return all.findIndex(function(p){ return p.e === o.e; }) === i;
});
