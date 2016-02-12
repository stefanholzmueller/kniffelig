module Test.Main where

import Prelude (Unit, bind)
import Control.Monad.Eff (Eff)
import Control.Monad.Eff.Console (CONSOLE, print)
import Control.Monad.Eff.Random (RANDOM)
--import Data.Array
import Durstenfeld (shuffle)
--import Test.QuickCheck
--import Test.QuickCheck.Gen

type RNG x = forall eff. Eff (random :: RANDOM | eff) x

dice :: RNG (Array Int)
dice = shuffle [1,2,3,4,5]

--main :: forall eff. Eff (random :: RANDOM, console :: CONSOLE | eff) Unit
main :: Eff (random :: RANDOM, console :: CONSOLE) Unit
main = do
	d <- dice
 	print d


--shuffled :: forall eff. Eff (random :: RANDOM | eff) (Array Int)
--shuffled = Durstenfeld.shuffle [1,2,3,4]

--main :: forall eff. QC eff Unit
--main = do
--        pips2 <- chooseInt 1 6
--        pips3 <- chooseInt 1 6
--        let dice5 = [pips2, pips2, pips3, pips3, pips3]
--        let dice = shuffle dice5
--        quickCheck \n -> n + 1 > n
